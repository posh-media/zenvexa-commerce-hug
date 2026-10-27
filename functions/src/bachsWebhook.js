/**
 * Bachs HTTPS webhook (Firebase Cloud Function).
 * Mirrors src/app/api/payments/bachs handling:
 * X-Bachs-Signature-V2 HMAC-SHA256 ("{timestamp}.{raw_body}") →
 * GET /v1/checkout-sessions/{id} verification → atomic Firestore →
 * Make.com (best-effort). Signing secrets live in the write-only
 * privatePaymentSettings/bachs document with env-var fallbacks.
 * Docs: https://docs.bachs.io/guides/webhooks/overview
 */
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { createHmac, timingSafeEqual } = require("crypto");
const {
  COLLECTIONS,
  COD_FEE_PURPOSE,
  computeCodCommitmentFee,
  log,
  toKobo,
  finalizeSuccessfulPayment,
  finalizeCodCommitmentFee,
  markPaymentFailed,
  notifyMake,
} = require("./finalizeShared");

const HANDLED = new Set([
  "collection.succeeded",
  "collection.failed",
  "checkout.completed",
  "checkout.expired",
]);

function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === "string") return Buffer.from(req.rawBody, "utf8");
  return null;
}

async function getBachsSecrets() {
  const snap = await getFirestore()
    .collection("privatePaymentSettings")
    .doc("bachs")
    .get();
  const data = snap.exists ? snap.data() : {};
  return {
    sandboxApiKey:
      data.sandboxApiKey || process.env.BACHS_SANDBOX_API_KEY || "",
    liveApiKey: data.liveApiKey || process.env.BACHS_LIVE_API_KEY || "",
    sandboxWebhookSecret:
      data.sandboxWebhookSecret ||
      process.env.BACHS_SANDBOX_WEBHOOK_SECRET ||
      "",
    liveWebhookSecret:
      data.liveWebhookSecret || process.env.BACHS_LIVE_WEBHOOK_SECRET || "",
  };
}

/**
 * Verify a Bachs delivery.
 * X-Bachs-Signature:    HMAC-SHA256 hex of "{timestamp}.{raw_body}"
 * X-Bachs-Signature-V2: "t={ts},v1={sig}" — accept if ANY v1 matches (rotation).
 * Rejects deliveries older than 300s (replay protection).
 */
function verifyBachsSignature(rawBody, headers, secrets, toleranceSeconds = 300) {
  const candidates = [
    secrets.sandboxWebhookSecret,
    secrets.liveWebhookSecret,
  ].filter((s) => typeof s === "string" && s.trim());
  if (!candidates.length) {
    log("webhook.signature", "No Bachs webhook signing secrets configured", {});
    return false;
  }

  let timestamp = (headers["x-bachs-timestamp"] || "").trim();
  const signatures = [];
  const v2 = headers["x-bachs-signature-v2"];
  if (v2) {
    for (const part of String(v2).split(",")) {
      const [key, value] = part.split("=", 2);
      if (key === "t" && value) timestamp = value.trim();
      if (key === "v1" && value) signatures.push(value.trim());
    }
  }
  const v1 = headers["x-bachs-signature"];
  if (v1) signatures.push(String(v1).trim());
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;

  const sentAt = Number(timestamp);
  if (Math.abs(Math.floor(Date.now() / 1000) - sentAt) > toleranceSeconds) {
    return false;
  }

  const payload = `${timestamp}.${rawBody.toString("utf8")}`;
  for (const secret of candidates) {
    const expected = createHmac("sha256", secret.trim())
      .update(payload)
      .digest("hex");
    for (const signature of signatures) {
      if (!/^[a-f0-9]{64}$/i.test(signature)) continue;
      if (
        timingSafeEqual(
          Buffer.from(expected, "hex"),
          Buffer.from(signature, "hex"),
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

async function getBachsCheckoutSession(checkoutId, sandbox, secrets) {
  const apiKey = sandbox ? secrets.sandboxApiKey : secrets.liveApiKey;
  if (!apiKey) throw new Error("Bachs API key is not configured.");
  const base = sandbox
    ? "https://sandbox-api.bachs.io"
    : "https://api.bachs.io";
  const response = await fetch(
    `${base}/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    throw new Error(`Bachs session lookup failed (${response.status})`);
  }
  return body;
}

exports.bachsWebhook = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, reason: "Method not allowed." });
      return;
    }

    const rawBodyBuffer = readRawBody(req);
    if (!rawBodyBuffer) {
      res.status(500).json({ ok: false, reason: "Raw body unavailable." });
      return;
    }

    let secrets;
    try {
      secrets = await getBachsSecrets();
    } catch (error) {
      log("webhook.failure", "Could not load Bachs credentials", {
        message: error?.message || String(error),
      });
      res.status(500).json({ ok: false, reason: "Bachs is not configured." });
      return;
    }

    if (!verifyBachsSignature(rawBodyBuffer, req.headers, secrets)) {
      log("webhook.signature", "Invalid or stale Bachs signature", {});
      res.status(401).json({ ok: false, reason: "Invalid signature." });
      return;
    }

    let event;
    try {
      event = JSON.parse(rawBodyBuffer.toString("utf8"));
    } catch {
      res.status(400).json({ ok: false, reason: "Invalid JSON." });
      return;
    }
    if (!event?.type || !HANDLED.has(event.type)) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }
    const data = event.data || {};
    const reference = data.reference;
    const checkoutId = data.checkout_id;
    if (!reference || !/^BA[a-f0-9]{32}$/.test(reference) || !checkoutId) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }
    const eventId = event.id || `${event.type}:${reference}`;

    const db = getFirestore();
    try {
      const paymentSnap = await db
        .collection(COLLECTIONS.payments)
        .where("reference", "==", reference)
        .limit(1)
        .get();
      const paymentDoc = paymentSnap.empty ? null : paymentSnap.docs[0];
      if (!paymentDoc) {
        res.status(200).json({ ok: true, ignored: true, reason: "payment_not_found" });
        return;
      }
      const payment = paymentDoc.data();
      const orderId = payment.orderId;
      const sandbox = payment.metadata?.sandbox !== false;

      const orderSnap = await db.collection(COLLECTIONS.orders).doc(orderId).get();
      if (!orderSnap.exists) {
        res.status(200).json({ ok: true, ignored: true, reason: "order_missing" });
        return;
      }
      const order = { id: orderSnap.id, ...orderSnap.data() };
      const isCodFee = payment.purpose === COD_FEE_PURPOSE;
      if (order.paymentMethod !== "bachs" && !isCodFee) {
        res.status(200).json({ ok: true, ignored: true, reason: "not_bachs_order" });
        return;
      }
      if (payment.checkoutId && payment.checkoutId !== checkoutId) {
        res.status(400).json({ ok: false, reason: "Checkout mismatch." });
        return;
      }

      if (event.type === "collection.failed" || event.type === "checkout.expired") {
        const result = await markPaymentFailed({
          orderId,
          reference,
          status: event.type === "checkout.expired" ? "expired" : "failed",
          reason: data.reason || event.type,
          eventId,
          paymentDocId: paymentDoc.id,
        });
        res.status(200).json({
          ok: result.ok,
          alreadyProcessed: result.alreadyProcessed || false,
        });
        return;
      }

      // collection.succeeded / checkout.completed — verify with the Bachs API
      // before trusting the event payload.
      let session;
      try {
        session = await getBachsCheckoutSession(checkoutId, sandbox, secrets);
      } catch (error) {
        log("webhook.verify", "Bachs session lookup failed", {
          checkoutId,
          message: error?.message || String(error),
        });
        res.status(502).json({ ok: false, reason: "Verification failed." });
        return;
      }

      if (session.status !== "completed") {
        res.status(200).json({ ok: true, ignored: true, reason: "not_completed" });
        return;
      }
      if (session.reference && session.reference !== reference) {
        res.status(400).json({ ok: false, reason: "Reference mismatch." });
        return;
      }

      const orderTotal = Number(order.total ?? order.totals?.total ?? 0);
      const expectedNaira = isCodFee
        ? Number(order.codCommitmentFee ?? computeCodCommitmentFee(orderTotal))
        : orderTotal;
      // Event money is a decimal string in major units — compare in kobo.
      if (data.amount !== undefined && data.amount !== null) {
        const eventAmountKobo = Math.round(Number(data.amount) * 100);
        if (
          !Number.isSafeInteger(eventAmountKobo) ||
          eventAmountKobo !== toKobo(expectedNaira) ||
          eventAmountKobo !== toKobo(Number(payment.amount))
        ) {
          log("webhook.failure", "Amount mismatch after verify", {
            orderId,
            expectedNaira,
            eventAmount: data.amount,
          });
          res.status(400).json({ ok: false, reason: "Amount mismatch." });
          return;
        }
      }
      if (
        data.currency &&
        String(data.currency).toUpperCase() !== "NGN"
      ) {
        res.status(400).json({ ok: false, reason: "Currency mismatch." });
        return;
      }

      const normalized = {
        reference,
        amount: toKobo(expectedNaira),
        currency: "NGN",
        status: "success",
        customer: {
          email: data.customer?.email || order.customer?.email,
        },
        channel: data.payment_method_details?.type,
        gatewayResponse: { event: event.type, data, session },
        paid_at: event.created_at || new Date().toISOString(),
      };
      const result = isCodFee
        ? await finalizeCodCommitmentFee({
            gateway: "bachs",
            orderId,
            verified: normalized,
            paymentDocId: paymentDoc.id,
            eventId,
          })
        : await finalizeSuccessfulPayment({
            gateway: "bachs",
            orderId,
            verified: normalized,
            paymentDocId: paymentDoc.id,
            eventId,
          });
      if (!result.ok) {
        res.status(500).json({ ok: false, reason: result.reason });
        return;
      }

      await notifyMake(result.order, reference);
      res.status(200).json({
        ok: true,
        alreadyProcessed: result.alreadyProcessed,
        orderId,
        reference,
      });
    } catch (error) {
      log("webhook.failure", "Unhandled webhook error", {
        message: error?.message || String(error),
      });
      res.status(500).json({ ok: false, reason: "Webhook processing failed." });
    }
  },
);
