/** Shared Firebase webhook compatibility bridge.
 * Legacy ShopBeta attempts continue through the original handlers. Attributed/versioned
 * attempts are forwarded byte-for-byte to an explicitly trusted store deployment,
 * which selects the persisted account version and verifies the provider signature/API.
 */
const { getFirestore } = require("firebase-admin/firestore");
const ORIGINS = {
  shopbeta: "https://www.shopbetaa.store",
  zenvexa: "https://www.zenvexacommerce.com",
};
function referenceFrom(event) {
  return (
    event?.data?.reference ||
    event?.TransactionRef ||
    event?.Body?.transaction_ref ||
    event?.eventData?.paymentReference
  );
}
function storeFrom(order) {
  if (order.storeId != null && String(order.storeId).trim())
    return ["shopbeta", "zenvexa"].includes(order.storeId)
      ? order.storeId
      : null;
  const name = order.storeName || order.store;
  if (name != null && String(name).trim()) {
    const key = String(name).replace(/\s+/g, "").toLowerCase();
    return ["shopbeta", "zenvexa"].includes(key) ? key : null;
  }
  return "shopbeta";
}
async function routeStoreWebhook(req, res, provider) {
  if (req.method !== "POST") return false;
  const raw = Buffer.isBuffer(req.rawBody)
    ? req.rawBody
    : typeof req.rawBody === "string"
      ? Buffer.from(req.rawBody)
      : null;
  if (!raw) return false;
  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return false;
  }
  const reference = referenceFrom(event);
  if (typeof reference !== "string" || reference.length > 200) return false;
  const db = getFirestore();
  const result = await db
    .collection("payments")
    .where("reference", "==", reference)
    .limit(2)
    .get();
  if (result.docs.length > 1) {
    res.status(409).json({ ok: false, reason: "Ambiguous payment reference." });
    return true;
  }
  if (result.docs.length !== 1) return false;
  const payment = result.docs[0].data();
  if (payment.gateway !== provider) return false;
  const snap = await db.collection("orders").doc(payment.orderId).get();
  if (!snap.exists) return false;
  const storeId = storeFrom(snap.data());
  const paymentHasAttribution = [
    payment.storeId,
    payment.storeName,
    payment.store,
  ].some((v) => v != null && String(v).trim());
  if (!storeId || (paymentHasAttribution && storeFrom(payment) !== storeId)) {
    res.status(409).json({ ok: false, reason: "Invalid store attribution." });
    return true;
  }
  if (storeId === "shopbeta" && !payment.credentialVersion) return false;
  const configured =
    process.env[storeId.toUpperCase() + "_WEBHOOK_ORIGIN"] || ORIGINS[storeId];
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.origin !== configured.replace(/\/$/, ""))
    throw new Error("Invalid trusted webhook origin.");
  const headers = { "Content-Type": "application/json" };
  for (const name of [
    "x-paystack-signature",
    "x-korapay-signature",
    "x-squad-encrypted-body",
    "monnify-signature",
    "x-bachs-signature",
    "x-bachs-signature-v2",
    "x-bachs-timestamp",
  ]) {
    if (typeof req.headers[name] === "string")
      headers[name] = req.headers[name];
  }
  const response = await fetch(
    `${url.origin}/api/payments/${provider}/webhook`,
    {
      method: "POST",
      headers,
      body: raw,
      redirect: "error",
      signal: AbortSignal.timeout(25000),
    },
  );
  res
    .status(response.status)
    .type("application/json")
    .send(await response.text());
  return true;
}
async function legacyInitializeAllowed(orderId) {
  if (typeof orderId !== "string" || orderId.includes("/")) return false;
  const snap = await getFirestore().collection("orders").doc(orderId).get();
  return snap.exists && storeFrom(snap.data()) === "shopbeta";
}
module.exports = {
  routeStoreWebhook,
  legacyInitializeAllowed,
  referenceFrom,
  storeFrom,
};
