/**
 * KoraPay Initialize Cloud Function
 * Handles KoraPay payment initialization for orders
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getKorapaySecretKey } = require("./env");
const { stripUndefined } = require("./stripUndefined");

const KORAPAY_BASE = "https://api.korapay.com/merchant/api/v1";

async function korapayFetch(path, init) {
  const secret = getKorapaySecretKey();
  if (!secret) {
    throw new HttpsError("internal", "KoraPay is not configured");
  }
  const response = await fetch(`${KORAPAY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await response.json();
  if (!response.ok || !body.status) {
    throw new HttpsError(
      "internal",
      body.message || `KoraPay error (${response.status})`
    );
  }
  return body;
}

function paymentReferenceForOrder(order) {
  const base = (order.orderNumber || order.id).replace(/[^a-zA-Z0-9]/g, "");
  return `SB_${base}_${Date.now()}`.slice(0, 100);
}

exports.korapayInitialize = onCall(async (request) => {
  const { orderId, callbackUrl } = request.data;

  if (!getKorapaySecretKey()) {
    throw new HttpsError("internal", "KoraPay is not configured");
  }

  if (!orderId) {
    throw new HttpsError("invalid-argument", "Order ID is required");
  }

  const db = getFirestore();
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new HttpsError("not-found", "Order not found");
  }

  const order = { id: orderSnap.id, ...orderSnap.data() };
  const method = String(order.paymentMethod ?? "");

  if (method !== "korapay") {
    throw new HttpsError("failed-precondition", "This order is not set up for KoraPay");
  }

  if (order.paymentStatus === "paid") {
    throw new HttpsError("failed-precondition", "This order is already paid");
  }

  const email = order.customer?.email?.trim();
  if (!email) {
    throw new HttpsError("failed-precondition", "Order is missing a customer email");
  }

  const amount = Number(order.total ?? order.totals?.total ?? 0);
  if (!(amount > 0)) {
    throw new HttpsError("failed-precondition", "Order total is invalid");
  }

  const reference = paymentReferenceForOrder(order);
  const redirectUrl =
    callbackUrl ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/payments/callback?order=${encodeURIComponent(order.orderNumber ?? order.id)}`;

  try {
    const initialized = await korapayFetch("/charges/initialize", {
      method: "POST",
      body: JSON.stringify({
        amount: amount, // KoraPay expects Naira, not kobo
        currency: "NGN",
        reference,
        customer: {
          name: order.customer?.name || "",
          email,
        },
        redirect_url: redirectUrl,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
        },
      }),
    });

    const paymentRef = db.collection("payments").doc();
    await paymentRef.set(
      stripUndefined({
        orderId: order.id,
        orderNumber: order.orderNumber ?? "",
        userId: order.userId,
        gateway: "korapay",
        reference: initialized.data.reference,
        amount,
        // KoraPay uses Naira directly, not kobo like Paystack
        currency: "NGN",
        status: "processing",
        customerEmail: email,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    );

    await orderRef.update(
      stripUndefined({
        paymentMethod: "korapay",
        paymentStatus: "processing",
        paymentReference: initialized.data.reference,
        paymentId: paymentRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      })
    );

    return {
      ok: true,
      authorizationUrl: initialized.data.checkout_url,
      reference: initialized.data.reference,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: paymentRef.id,
    };
  } catch (error) {
    console.error("KoraPay initialize error:", error);
    throw new HttpsError("internal", "Failed to initialize KoraPay payment");
  }
});
