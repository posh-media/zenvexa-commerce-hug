/**
 * Squad HTTPS webhook (Firebase Cloud Function).
 * Mirrors src/app/api/payments/squad/webhook/route.ts behaviour:
 * x-squad-encrypted-body HMAC-SHA512 → Squad verify API → atomic Firestore →
 * Make.com (best-effort). Secret keys are read from the write-only
 * privatePaymentSettings/squad document with env-var fallbacks.
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
  amountsMatch,
  finalizeSuccessfulPayment,
  finalizeCodCommitmentFee,
  markPaymentFailed,
  notifyMake,
} = require("./finalizeShared");

function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === "string") return Buffer.from(req.rawBody, "utf8");
  return null;
}

/** Squad credentials: privatePaymentSettings/squad → env fallbacks. */
async function getSquadSecrets() {
  const snap = await getFirestore()
    .collection("privatePaymentSettings")
    .doc("squad")
    .get();
  const data = snap.exists ? snap.data() : {};
  return {
    sandboxSecretKey:
      data.sandboxSecretKey || process.env.SQUAD_TEST_SECRET_KEY || "",
    liveSecretKey:
      data.liveSecretKey || process.env.SQUAD_LIVE_SECRET_KEY || "",
  };
}

/** Hosted checkout signs with x-squad-encrypted-body = HMAC-SHA512(rawBody, key). */
function verifySquadSignature(rawBody, signature, secrets) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const candidates = [secrets.sandboxSecretKey, secrets.liveSecretKey].filter(
    (k) => typeof k === "string" && k.trim(),
  );
  if (!candidates.length) {
    log("webhook.signature", "No Squad secret keys configured", {});
    return false;
  }
  for (const secret of candidates) {
    const expected = createHmac("sha512", secret.trim())
      .update(rawBody)
      .digest();
    if (timingSafeEqual(expected, Buffer.from(signature, "hex"))) return true;
  }
  return false;
}

async function verifyWithSquad(reference, sandbox, secrets) {
  const secretKey = sandbox
    ? secrets.sandboxSecretKey
    : secrets.liveSecretKey;
  if (!secretKey) throw new Error("Squad secret key is not configured.");
  const base = sandbox
    ? "https://sandbox-api-d.squadco.com"
    : "https://api-d.squadco.com";
  const response = await fetch(
    `${base}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
  );
  const body = await response.json();
  if (
    !response.ok ||
    body.success === false ||
    (body.success !== true && body.status !== 200) ||
    !body.data
  ) {
    throw new Error(`Squad verify failed (${response.status})`);
  }
  return body.data;
}

exports.squadWebhook = onRequest(
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
    const signature = req.get("x-squad-encrypted-body");

    if (!rawBodyBuffer) {
      res.status(500).json({ ok: false, reason: "Raw body unavailable." });
      return;
    }

    let secrets;
    try {
      secrets = await getSquadSecrets();
    } catch (error) {
      log("webhook.failure", "Could not load Squad credentials", {
        message: error?.message || String(error),
      });
      res.status(500).json({ ok: false, reason: "Squad is not configured." });
      return;
    }

    if (!verifySquadSignature(rawBodyBuffer, signature, secrets)) {
      log("webhook.signature", "Invalid Squad signature", {});
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

    if (!event || event.Event !== "charge_successful") {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }
    const reference = event.TransactionRef || event.Body?.transaction_ref;
    if (!reference || !/^SQ[a-f0-9]{32}$/.test(reference)) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }
    if (event.Body?.transaction_ref && event.Body.transaction_ref !== reference) {
      res.status(400).json({ ok: false, reason: "Reference mismatch." });
      return;
    }

    const eventId = `charge_successful:${reference}`;
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
      if (order.paymentMethod !== "squad" && !isCodFee) {
        res.status(200).json({ ok: true, ignored: true, reason: "not_squad_order" });
        return;
      }

      // Server-side verification against Squad's transaction API.
      let verified;
      try {
        verified = await verifyWithSquad(reference, sandbox, secrets);
      } catch (error) {
        log("webhook.verify", "Squad verify API failed", {
          reference,
          message: error?.message || String(error),
        });
        res.status(502).json({ ok: false, reason: "Verification failed." });
        return;
      }

      if (verified.transaction_ref !== reference) {
        res.status(400).json({ ok: false, reason: "Reference mismatch." });
        return;
      }
      const status = String(verified.transaction_status || "").toLowerCase();
      if (status !== "success") {
        if (status === "failed" || status === "abandoned") {
          await markPaymentFailed({
            orderId,
            reference,
            status: status === "abandoned" ? "cancelled" : "failed",
            reason: `Squad status: ${status}`,
            eventId,
            paymentDocId: paymentDoc.id,
          });
        }
        res.status(200).json({ ok: true, ignored: true, reason: "not_successful" });
        return;
      }
      if (
        String(verified.transaction_currency_id || "NGN").toUpperCase() !== "NGN"
      ) {
        res.status(400).json({ ok: false, reason: "Currency mismatch." });
        return;
      }
      const orderTotal = Number(order.total ?? order.totals?.total ?? 0);
      const expectedTotal = isCodFee
        ? Number(order.codCommitmentFee ?? computeCodCommitmentFee(orderTotal))
        : orderTotal;
      const paidKobo = Number(verified.transaction_amount);
      // Validate against the recorded payment AND the order/fee expectation.
      if (
        !Number.isSafeInteger(paidKobo) ||
        paidKobo !== toKobo(Number(payment.amount)) ||
        !amountsMatch(expectedTotal, paidKobo)
      ) {
        log("webhook.failure", "Amount mismatch after verify", {
          orderId,
          expectedTotal,
          paidKobo,
        });
        res.status(400).json({ ok: false, reason: "Amount mismatch." });
        return;
      }
      const orderEmail = order.customer?.email?.trim().toLowerCase();
      const paidEmail = verified.email?.trim().toLowerCase();
      if (orderEmail && paidEmail && orderEmail !== paidEmail) {
        res.status(400).json({ ok: false, reason: "Customer email mismatch." });
        return;
      }

      const normalized = {
        reference,
        amount: paidKobo,
        currency: verified.transaction_currency_id || "NGN",
        status: "success",
        customer: { email: verified.email },
        channel: verified.transaction_type,
        gatewayResponse: verified,
        paid_at: verified.created_at || new Date().toISOString(),
      };
      const result = isCodFee
        ? await finalizeCodCommitmentFee({
            gateway: "squad",
            orderId,
            verified: normalized,
            paymentDocId: paymentDoc.id,
            eventId,
          })
        : await finalizeSuccessfulPayment({
            gateway: "squad",
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
