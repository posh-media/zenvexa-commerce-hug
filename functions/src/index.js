import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { commerceService } from "./commerce-service.js";
import { adminService } from "./admin-service.js";
import {
  DomainError,
  requireValue,
  object,
  id,
  text,
  verifySignature,
  checkoutInput,
} from "./core.js";

initializeApp();
const db = getFirestore();
const service = commerceService(db);
const administration = adminService(db);
const paystackConfigured = process.env.PAYSTACK_MODE === "test";
const paystackSecret = paystackConfigured ? defineSecret("PAYSTACK_SECRET_KEY") : null;
const paystackMode = paystackConfigured
  ? defineString("PAYSTACK_MODE", { default: "disabled" })
  : { value: () => "disabled" };
const appUrl = paystackConfigured
  ? defineString("STOREFRONT_URL", { default: "http://localhost:3000" })
  : { value: () => "" };
const local = process.env.FUNCTIONS_EMULATOR === "true";
const paymentSecrets = paystackSecret ? [paystackSecret] : [];
const options = {
  region: "europe-west1",
  enforceAppCheck: !local,
  maxInstances: 5,
  timeoutSeconds: 60,
};
function callable(handler, secrets = []) {
  return onCall(
    { ...options, secrets: local && process.env.PAYSTACK_MODE !== "test" ? [] : secrets },
    async (request) => {
      try {
        requireValue(request.auth, "Sign in before continuing.", "unauthenticated");
        await db.runTransaction(async (tx) => {
          const ref = db.doc(`operationLimits/${request.auth.uid}`);
          const snap = await tx.get(ref);
          const now = Date.now();
          const recent = snap.exists && now - snap.data().start < 60000;
          requireValue(
            !recent || snap.data().count < 60,
            "Too many requests. Retry shortly.",
            "resource-exhausted",
          );
          tx.set(ref, {
            start: recent ? snap.data().start : now,
            count: recent ? snap.data().count + 1 : 1,
          });
        });
        return await handler(request);
      } catch (error) {
        if (error instanceof DomainError) throw new HttpsError(error.code, error.message);
        throw new HttpsError(
          "internal",
          "Operation could not be completed. Please retry or contact support.",
        );
      }
    },
  );
}
function verifiedStaffIdentity(request) {
  requireValue(
    request.auth.token.email_verified === true &&
      request.auth.token.firebase?.sign_in_provider !== "anonymous",
    "Use a verified staff account.",
    "permission-denied",
  );
  return request.auth.uid;
}
function key() {
  requireValue(
    paystackMode.value() === "test",
    "Electronic payments are disabled. No payment was requested.",
    "failed-precondition",
  );
  const secret = paystackSecret?.value();
  requireValue(
    secret.startsWith("sk_test_"),
    "Only Paystack test credentials are accepted by this foundation.",
    "failed-precondition",
  );
  return secret;
}
async function gateway(path, init = {}) {
  const secret = key();
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  requireValue(
    response.ok,
    "Payment provider is unavailable. Use verification before retrying.",
    "unavailable",
  );
  const payload = await response.json();
  requireValue(
    payload.status === true && payload.data,
    "Payment provider could not complete the request.",
    "unavailable",
  );
  return payload.data;
}
export const createOrder = callable((request) => {
  const input = checkoutInput(request.data);
  requireValue(
    input.paymentMethod === "pod" || request.auth.token.email_verified === true,
    "Use a verified email account for electronic checkout. Guests can use Pay on Delivery.",
    "failed-precondition",
  );
  return service.createOrder(request.auth.uid, input);
});
export const adminRead = callable((request) =>
  administration.read(verifiedStaffIdentity(request), request.data),
);
export const adminDashboard = callable((request) =>
  administration.dashboard(verifiedStaffIdentity(request), request.data),
);
export const adminOrderDetail = callable((request) =>
  administration.orderDetail(verifiedStaffIdentity(request), request.data),
);
export const adjustInventory = callable((request) =>
  administration.adjustInventory(verifiedStaffIdentity(request), request.data),
);
export const saveConfiguration = callable((request) =>
  administration.saveConfiguration(verifiedStaffIdentity(request), request.data),
);
export const saveProduct = callable((request) =>
  service.saveProduct(verifiedStaffIdentity(request), request.data),
);
export const updateOrderStatus = callable((request) => {
  object(request.data, ["orderId", "status"]);
  return service.transition(verifiedStaffIdentity(request), request.data);
});
export const collectPod = callable((request) => {
  object(request.data, ["orderId", "receipt"]);
  return service.collectPod(verifiedStaffIdentity(request), request.data);
});
export const initializePayment = callable(async (request) => {
  object(request.data, ["orderId"]);
  key();
  requireValue(
    request.auth.token.email_verified === true,
    "Verify your account email before electronic checkout.",
    "failed-precondition",
  );
  const email = text(request.auth.token.email, 254);
  const attempt = await service.preparePayment(request.auth.uid, id(request.data.orderId), email);
  if (attempt.authorizationUrl)
    return { reference: attempt.reference, authorizationUrl: attempt.authorizationUrl };
  requireValue(
    attempt.status === "initializing",
    "Verify the existing attempt; do not create another payment.",
    "failed-precondition",
  );
  const callback = new URL(appUrl.value());
  requireValue(
    callback.protocol === "https:" ||
      (local && ["localhost", "127.0.0.1"].includes(callback.hostname)),
    "Storefront callback is not configured.",
    "failed-precondition",
  );
  callback.searchParams.set("paymentOrder", attempt.orderId);
  const channels = { card: ["card"], transfer: ["bank_transfer"], ussd: ["ussd"] };
  const result = await gateway("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: attempt.email,
      amount: attempt.amountKobo,
      currency: "NGN",
      reference: attempt.reference,
      callback_url: callback.toString(),
      channels: channels[attempt.paymentMethod],
      metadata: { orderId: attempt.orderId, userId: attempt.userId },
    }),
  });
  const url = new URL(result.authorization_url);
  requireValue(
    url.protocol === "https:" &&
      url.hostname === "checkout.paystack.com" &&
      result.reference === attempt.reference,
    "Invalid provider checkout response.",
    "failed-precondition",
  );
  await db
    .doc(`paymentAttempts/${attempt.reference}`)
    .update({ authorizationUrl: url.toString(), status: "initialized" });
  return { reference: attempt.reference, authorizationUrl: url.toString() };
}, paymentSecrets);
export const verifyPayment = callable(async (request) => {
  object(request.data, ["orderId"]);
  const order = await db.doc(`orders/${id(request.data.orderId)}`).get();
  requireValue(
    order.exists && order.data().userId === request.auth.uid,
    "Order not found.",
    "permission-denied",
  );
  const reference = order.data().paymentReference;
  requireValue(reference, "No payment attempt exists.", "failed-precondition");
  const payment = await gateway(`/transaction/verify/${encodeURIComponent(reference)}`);
  return service.applyPayment(reference, payment);
}, paymentSecrets);
export const paystackWebhook = onRequest(
  {
    region: options.region,
    maxInstances: 5,
    secrets: local && process.env.PAYSTACK_MODE !== "test" ? [] : paymentSecrets,
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.sendStatus(405);
      return;
    }
    if (paystackMode.value() !== "test") {
      response.sendStatus(503);
      return;
    }
    try {
      const secret = key();
      if (!verifySignature(request.rawBody, request.get("x-paystack-signature"), secret)) {
        response.sendStatus(401);
        return;
      }
      const payload = JSON.parse(request.rawBody.toString("utf8"));
      if (payload.event === "charge.success") {
        const reference = id(payload.data?.reference);
        const verified = await gateway(`/transaction/verify/${encodeURIComponent(reference)}`);
        await service.applyPayment(reference, verified);
      } else if (payload.event === "refund.processed") {
        const refundId = String(payload.data?.id);
        requireValue(/^\d+$/.test(refundId), "Invalid refund.");
        const refund = await gateway(`/refund/${refundId}`);
        await service.applyRefund(id(refund.transaction?.reference), refund);
      }
      response.status(200).json({ received: true });
    } catch {
      response.status(503).json({ received: false });
    }
  },
);
