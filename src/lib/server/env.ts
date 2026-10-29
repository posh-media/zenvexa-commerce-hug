import { CURRENCY } from "@/constants/app";
import { currentStoreId, deploymentEnv } from "@/lib/server/store-context";
import { deploymentStoreId } from "@/lib/store";

/** Canonical production storefront URL — never redirect customers to localhost. */
export const PRODUCTION_SITE_URL = "https://www.shopbetaa.store";

export function getAppUrl() {
  const id = currentStoreId();
  const configured =
    (id === deploymentStoreId()
      ? process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL
      : undefined) || process.env[`${id.toUpperCase()}_APP_URL`];
  const origin =
    configured ||
    (id === "shopbeta"
      ? PRODUCTION_SITE_URL
      : "https://www.zenvexacommerce.com");
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw new Error("Invalid store URL.");
  return url.origin;
}
export function trustedCallbackUrl(
  value: string | undefined,
  fallback: string,
) {
  if (!value) return fallback;
  const url = new URL(value);
  if (url.origin !== new URL(getAppUrl()).origin)
    throw new Error("Untrusted payment return URL.");
  return url.toString();
}

export async function getPaystackSecretKey() {
  const { getPaymentSecretKey } = await import("@/services/settings.service");
  const key = await getPaymentSecretKey("paystack");
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
    deploymentEnv("MAKE_WEBHOOK_URL")?.trim() ||
    deploymentEnv("MAKE_COM_WEBHOOK_URL")?.trim() ||
    ""
  );
}

export async function isCodEnabled() {
  // COD is handled differently - check settings or fallback to env
  const settings = await import("@/services/settings.service").then((m) =>
    m.getAppSettings(),
  );
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
  const { isPaymentProviderEnabled } =
    await import("@/services/settings.service");
  return await isPaymentProviderEnabled("flutterwave");
}

export async function isKorapayEnabled() {
  const { isPaymentProviderEnabled } =
    await import("@/services/settings.service");
  return await isPaymentProviderEnabled("korapay");
}

export async function getKorapaySecretKey() {
  const { getPaymentSecretKey } = await import("@/services/settings.service");
  const key = await getPaymentSecretKey("korapay");
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
  const key = await getPaymentSecretKey("korapay");
  return Boolean(key);
}

export async function isPaystackConfigured() {
  const { getPaymentSecretKey } = await import("@/services/settings.service");
  const key = await getPaymentSecretKey("paystack");
  return Boolean(key);
}

export async function isPaystackEnabled() {
  const { isPaymentProviderEnabled } =
    await import("@/services/settings.service");
  return await isPaymentProviderEnabled("paystack");
}

export async function isBachsEnabled() {
  const { getAppSettings } = await import("@/services/settings.service");
  const settings = await getAppSettings();
  const enabled = settings?.payments?.bachsEnabled;
  if (enabled !== undefined) return enabled;
  return process.env.NEXT_PUBLIC_BACHS_ENABLED === "true";
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
