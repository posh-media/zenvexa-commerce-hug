import { CURRENCY } from "@/constants/app";

export function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export async function getPaystackSecretKey() {
  const { getPaymentSecretKey } = await import("@/services/settings.service");
  const key = await getPaymentSecretKey('paystack');
  if (!key) {
    throw new Error("Paystack secret key is not configured.");
  }
  return key;
}

export function getPaystackPublicKey() {
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY?.trim() ?? "";
}

export async function getPaystackWebhookSecret() {
  const secretKey = await getPaystackSecretKey();
  return secretKey;
}

export function getMakeWebhookUrl() {
  return (
    process.env.MAKE_WEBHOOK_URL?.trim() ||
    process.env.MAKE_COM_WEBHOOK_URL?.trim() ||
    ""
  );
}

export async function isCodEnabled() {
  // COD is handled differently - check settings or fallback to env
  const settings = await import("@/services/settings.service").then(m => m.getAppSettings());
  const codEnabled = settings?.payments?.codEnabled;
  
  if (codEnabled !== undefined) {
    return codEnabled;
  }
  
  // Fallback to environment variable
  const raw = process.env.NEXT_PUBLIC_COD_ENABLED ?? "true";
  return raw !== "0" && raw.toLowerCase() !== "false";
}

/** Configured states/regions where Payment on Delivery is allowed. */
export async function getCodAllowedStates() {
  const settings = await import("@/services/settings.service").then((m) =>
    m.getAppSettings(),
  );
  const { normalizeAllowedStates } = await import("@/lib/cod");
  return normalizeAllowedStates(
    settings?.payments?.paymentOnDeliveryAllowedStates,
  );
}

export async function isFlutterwaveEnabled() {
  const { isPaymentProviderEnabled } = await import("@/services/settings.service");
  return await isPaymentProviderEnabled('flutterwave');
}

export async function isKorapayEnabled() {
  const { isPaymentProviderEnabled } = await import("@/services/settings.service");
  return await isPaymentProviderEnabled('korapay');
}

export async function getKorapaySecretKey() {
  const { getPaymentSecretKey } = await import("@/services/settings.service");
  const key = await getPaymentSecretKey('korapay');
  if (!key) {
    throw new Error("KoraPay secret key is not configured.");
  }
  return key;
}

export function getKorapayPublicKey() {
  return process.env.NEXT_PUBLIC_KORAPAY_PUBLIC_KEY?.trim() ?? "";
}

export async function isKorapayConfigured() {
  const { getPaymentSecretKey } = await import("@/services/settings.service");
  const key = await getPaymentSecretKey('korapay');
  return Boolean(key);
}

export async function isPaystackConfigured() {
  const { getPaymentSecretKey } = await import("@/services/settings.service");
  const key = await getPaymentSecretKey('paystack');
  return Boolean(key);
}

export async function isPaystackEnabled() {
  const { isPaymentProviderEnabled } = await import("@/services/settings.service");
  return await isPaymentProviderEnabled('paystack');
}

/** HTTPS base for Paystack Cloud Functions (initialize + webhook). */
export function getPaystackFunctionsBaseUrl() {
  return (
    process.env.PAYSTACK_FUNCTIONS_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_PAYSTACK_FUNCTIONS_BASE_URL?.replace(/\/$/, "") ||
    "https://us-central1-shop-day84j.cloudfunctions.net"
  );
}

export function defaultCurrency() {
  return process.env.NEXT_PUBLIC_CURRENCY?.trim() || CURRENCY.code;
}

/** Convert Naira major units to Paystack kobo. */
export function toKobo(amountNaira: number) {
  return Math.round(amountNaira * 100);
}

export function fromKobo(amountKobo: number) {
  return amountKobo / 100;
}
