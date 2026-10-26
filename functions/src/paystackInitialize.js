/**
 * Paystack Initialize — HTTPS Cloud Function.
 * Creates a Paystack transaction for a pending order and returns authorization_url.
 * Runs with Firebase Admin (default compute SA) so local Next.js does not need
 * FIREBASE_SERVICE_ACCOUNT for the redirect checkout path.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { stripUndefined } = require("./stripUndefined");
const { getPaystackSecretKey } = require("./env");

const COLLECTIONS = {
  orders: "orders",
  payments: "payments",
};

function log(stage, message, meta = {}) {
  console.log(
    JSON.stringify({
      payment: {
        at: new Date().toISOString(),
        stage,
        message,
        ...meta,
      },
    }),
  );
}

function toKobo(naira) {
  return Math.round(Number(naira) * 100);
}

function paymentReferenceForOrder(order) {
  const base = String(order.orderNumber || order.id).replace(/[^a-zA-Z0-9]/g, "");
  return `SB_${base}_${Date.now()}`.slice(0, 100);
}

const LABELS = {
  payment_processing: {
    label: "Payment processing",
    description: "Your payment is being confirmed.",
  },
};

function appendTimeline(timeline, event) {
  const meta = LABELS[event] || { label: event };
  const entry = {
    event,
    label: meta.label,
    description: meta.description || null,
    at: new Date(),
  };
  return Array.isArray(timeline) ? [...timeline, entry] : [entry];
}

async function callPaystackInitialize(payload) {
  const secret = getPaystackSecretKey();
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok || !body.status) {
    throw new Error(body.message || `Paystack initialize failed (${response.status})`);
  }
  return body.data;
}

exports.paystackInitialize = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    cors: true,
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, reason: "Method not allowed." });
      return;
    }

    const orderId = String(req.body?.orderId || "").trim();
    const callbackUrl = String(req.body?.callbackUrl || "").trim();

    log("init.incoming", "Paystack initialize requested", {
      orderId,
      hasCallback: Boolean(callbackUrl),
    });

    if (!orderId) {
      res.status(400).json({ ok: false, reason: "orderId is required." });
      return;
    }

    if (!getPaystackSecretKey()) {
      log("init.failure", "PAYSTACK_SECRET_KEY missing", {});
      res.status(500).json({
        ok: false,
        reason: "Paystack is not configured on the server.",
      });
      return;
    }

    try {
      const db = getFirestore();
      const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        log("init.failure", "Order not found", { orderId });
        res.status(404).json({ ok: false, reason: "Order not found." });
        return;
      }

      const order = { id: orderSnap.id, ...orderSnap.data() };
      const method = String(order.paymentMethod || "");
      if (method !== "paystack" && method !== "card") {
        res.status(400).json({
          ok: false,
          reason: "This order is not set up for Paystack.",
        });
        return;
      }

      if (order.paymentStatus === "paid") {
        res.status(400).json({ ok: false, reason: "This order is already paid." });
        return;
      }

      const email = order.customer?.email?.trim();
      if (!email) {
        res.status(400).json({
          ok: false,
          reason: "Order is missing a customer email.",
        });
        return;
      }

      const amount = Number(order.total ?? order.totals?.total ?? 0);
      if (!(amount > 0)) {
        res.status(400).json({ ok: false, reason: "Order total is invalid." });
        return;
      }

      const amountKobo = toKobo(amount);
      if (amountKobo < 100) {
        res.status(400).json({
          ok: false,
          reason: "Order total is too small to charge.",
        });
        return;
      }

      const reference = paymentReferenceForOrder(order);
      const resolvedCallback =
        callbackUrl ||
        `https://shop-day84j.web.app/payments/callback?order=${encodeURIComponent(order.orderNumber || order.id)}`;

      log("init.paystack", "Calling Paystack Initialize API", {
        orderId,
        reference,
        amountKobo,
        email,
      });

      const initialized = await callPaystackInitialize({
        email,
        amount: amountKobo,
        reference,
        currency: "NGN",
        callback_url: resolvedCallback,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber || null,
          userId: order.userId || null,
          cancel_action: `${resolvedCallback.split("?")[0]}?cancelled=1&reference=${encodeURIComponent(reference)}`,
        },
      });

      log("init.paystack", "Paystack Initialize response OK", {
        orderId,
        reference: initialized.reference,
        hasAuthorizationUrl: Boolean(initialized.authorization_url),
        hasAccessCode: Boolean(initialized.access_code),
      });

      const paymentRef = db.collection(COLLECTIONS.payments).doc();
      await paymentRef.set(
        stripUndefined({
          orderId: order.id,
          orderNumber: order.orderNumber || null,
          userId: order.userId,
          gateway: "paystack",
          reference: initialized.reference,
          amount,
          amountKobo,
          currency: "NGN",
          status: "processing",
          customerEmail: email,
          metadata: {
            accessCode: initialized.access_code || null,
          },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );

      await orderRef.update(
        stripUndefined({
          paymentMethod: "paystack",
          paymentStatus: "processing",
          paymentReference: initialized.reference,
          paymentId: paymentRef.id,
          timeline: appendTimeline(order.timeline, "payment_processing"),
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );

      log("init.firestore", "Order + payment updated", {
        orderId,
        paymentId: paymentRef.id,
        reference: initialized.reference,
      });

      log("init.redirect", "Returning authorization_url", {
        orderId,
        reference: initialized.reference,
      });

      res.status(200).json({
        ok: true,
        authorizationUrl: initialized.authorization_url,
        accessCode: initialized.access_code,
        reference: initialized.reference,
        orderId: order.id,
        orderNumber: order.orderNumber || null,
        paymentId: paymentRef.id,
      });
    } catch (error) {
      log("init.failure", "Initialize failed", {
        orderId,
        message: error?.message || String(error),
      });
      res.status(500).json({
        ok: false,
        reason: error?.message || "Could not initialize payment.",
      });
    }
  },
);
