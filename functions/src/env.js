/**
 * Environment variables for Cloud Functions
 */

function getKorapaySecretKey() {
  const key = process.env.KORAPAY_SECRET_KEY?.trim();
  if (!key) {
    console.error("KORAPAY_SECRET_KEY is not configured");
    return null;
  }
  console.log("KoraPay secret key loaded successfully");
  return key;
}

function getPaystackSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) {
    console.error("PAYSTACK_SECRET_KEY is not configured");
    return null;
  }
  console.log("Paystack secret key loaded successfully");
  return key;
}

module.exports = {
  getKorapaySecretKey,
  getPaystackSecretKey,
};
