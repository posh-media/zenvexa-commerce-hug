import { authenticatedFetch } from "@/lib/client-api";
/**
 * Client-side payment helpers — call backend routes only (no secrets).
 */

export type InitializePaystackResponse =
  | {
      ok: true;
      authorizationUrl: string;
      accessCode?: string | null;
      reference: string;
      orderId: string;
      orderNumber?: string | null;
    }
  | { ok: false; reason: string };

export type VerifyPaystackResponse =
  | {
      ok: true;
      alreadyProcessed?: boolean;
      reference: string;
      order: {
        id: string;
        orderNumber?: string;
        paymentStatus?: string;
        orderStatus?: string;
        total?: number;
      };
      payment: {
        reference: string;
        status: string;
        amount: number;
        currency: string;
        channel?: string;
      };
    }
  | {
      ok: false;
      reason: string;
      status?: string;
      orderId?: string;
      reference?: string;
      code?: string;
    };

export type ConfirmCodResponse =
  | {
      ok: true;
      alreadyProcessed?: boolean;
      order: {
        id: string;
        orderNumber?: string;
        paymentStatus?: string;
        orderStatus?: string;
        total?: number;
      };
    }
  | { ok: false; reason: string; code?: string };

function clientPaymentLog(
  stage: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  // Temporary flow diagnostics (browser console)
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      payment: { at: new Date().toISOString(), stage, message, ...meta },
    }),
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await authenticatedFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    throw new Error("Payment service returned an invalid response.");
  }
  return data;
}

export async function initializePaystackPayment(input: {
  orderId: string;
  callbackUrl?: string;
}): Promise<InitializePaystackResponse> {
  clientPaymentLog(
    "init.request",
    "Calling /api/payments/paystack/initialize",
    {
      orderId: input.orderId,
      hasCallback: Boolean(input.callbackUrl),
    },
  );

  const result = await postJson<InitializePaystackResponse>(
    "/api/payments/paystack/initialize",
    input,
  );

  if (result.ok) {
    clientPaymentLog("init.paystack", "Initialize API success", {
      orderId: result.orderId,
      reference: result.reference,
      hasAuthorizationUrl: Boolean(result.authorizationUrl),
      hasAccessCode: Boolean(result.accessCode),
    });
  } else {
    clientPaymentLog("init.failure", "Initialize API rejected", {
      reason: result.reason,
    });
  }

  return result;
}

export function verifyPaystackPayment(reference: string) {
  return postJson<VerifyPaystackResponse>("/api/payments/paystack/verify", {
    reference,
  });
}

export function confirmCashOnDelivery(orderId: string) {
  return postJson<ConfirmCodResponse>("/api/payments/cod/confirm", {
    orderId,
  });
}

export type CodFeeGateway =
  "paystack" | "korapay" | "squad" | "monnify" | "bachs";

export function initializeCodCommitmentFeePayment(input: {
  orderId: string;
  gateway: CodFeeGateway;
}) {
  return postJson<InitializePaystackResponse & { commitmentFee?: number }>(
    "/api/payments/cod/fee",
    input,
  );
}

export function reverifyOrderPayment(orderId: string) {
  return postJson<
    | {
        ok: true;
        alreadyPaid?: boolean;
        alreadyProcessed?: boolean;
        codCommitmentFee?: boolean;
        order: {
          id: string;
          orderNumber?: string;
          paymentStatus?: string;
          orderStatus?: string;
        };
      }
    | { ok: false; reason: string; status?: string }
  >("/api/payments/reverify", { orderId });
}

export function getPaystackPublicKey() {
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY?.trim() ?? "";
}

// Payment provider availability cache
export type PaymentProviderSettings = {
  monnify: boolean;
  squad: boolean;
  paystack: boolean;
  korapay: boolean;
  flutterwave: boolean;
  bachs: boolean;
  cod: boolean;
  codAllowedStates: string[];
  availabilityError?: string;
};
let providerSettings: PaymentProviderSettings | null = null;
let providerSettingsFetchedAt = 0;
const disabledProviders: PaymentProviderSettings = {
  monnify: false, squad: false, paystack: false, korapay: false,
  flutterwave: false, bachs: false, cod: false, codAllowedStates: [],
};

async function fetchProviderSettings(): Promise<PaymentProviderSettings> {
  try {
    const response = await fetch("/api/payment-settings", { cache: "no-store" });
    if (!response.ok) throw new Error("Payment settings service unavailable.");
    const data = await response.json();
    if (!data || data.ok === false || typeof data.squad !== "boolean") throw new Error("Invalid payment settings response.");
    providerSettings = {
      monnify: data.monnify === true,
      squad: data.squad === true,
      paystack: data.paystack === true,
      korapay: data.korapay === true,
      flutterwave: data.flutterwave === true,
      bachs: data.bachs === true,
      cod: data.cod === true,
      codAllowedStates: Array.isArray(data.codAllowedStates)
        ? data.codAllowedStates.filter((state: unknown): state is string => typeof state === "string")
        : [],
    };
    providerSettingsFetchedAt = Date.now();
    return providerSettings;
  } catch (error) {
    console.error("Failed to fetch payment settings:", error);
    // Fallback to disabled options while configuration is unavailable
    return { ...disabledProviders, availabilityError: "Payment options could not be loaded. Please retry shortly or contact support; do not submit payment again if you have already paid." };
  }
}

export async function getPaymentProviderSettings(): Promise<PaymentProviderSettings> {
  if (typeof window === "undefined") return { ...disabledProviders };
  if (providerSettings && Date.now() - providerSettingsFetchedAt < 60000) return providerSettings;
  return fetchProviderSettings();
}

export function clearPaymentProviderSettingsCache() {
  providerSettings = null;
}

export async function isClientPaystackEnabled() {
  const settings = await getPaymentProviderSettings();
  return settings.paystack;
}

export async function isClientKorapayEnabled() {
  const settings = await getPaymentProviderSettings();
  return settings.korapay;
}

export async function isClientFlutterwaveEnabled() {
  const settings = await getPaymentProviderSettings();
  return settings.flutterwave;
}

export async function isClientBachsEnabled() {
  const settings = await getPaymentProviderSettings();
  return settings.bachs;
}

export async function isClientCodEnabled() {
  const settings = await getPaymentProviderSettings();
  return settings.cod;
}

export type InitializeKorapayResponse =
  | {
      ok: true;
      authorizationUrl: string;
      reference: string;
      orderId: string;
      orderNumber?: string | null;
      paymentId?: string;
    }
  | { ok: false; reason: string };

export async function initializeKorapayPayment(input: {
  orderId: string;
  callbackUrl?: string;
}): Promise<InitializeKorapayResponse> {
  clientPaymentLog("init.request", "Calling /api/payments/korapay/initialize", {
    orderId: input.orderId,
    hasCallback: Boolean(input.callbackUrl),
  });

  const result = await postJson<InitializeKorapayResponse>(
    "/api/payments/korapay/initialize",
    input,
  );

  if (result.ok) {
    clientPaymentLog("init.korapay", "Initialize API success", {
      orderId: result.orderId,
      reference: result.reference,
      hasAuthorizationUrl: Boolean(result.authorizationUrl),
    });
  } else {
    clientPaymentLog("init.failure", "Initialize API rejected", {
      reason: result.reason,
    });
  }

  return result;
}

export function verifyKorapayPayment(reference: string) {
  return postJson<VerifyPaystackResponse>("/api/payments/korapay/verify", {
    reference,
  });
}

export function initializeSquadPayment(input: { orderId: string }) {
  return postJson<InitializePaystackResponse>(
    "/api/payments/squad/initialize",
    input,
  );
}

export function verifySquadPayment(reference: string) {
  return postJson<VerifyPaystackResponse>("/api/payments/squad/verify", {
    reference,
  });
}

export function initializeMonnifyPayment(input: { orderId: string }) {
  return postJson<InitializePaystackResponse>(
    "/api/payments/monnify/initialize",
    input,
  );
}
export function verifyMonnifyPayment(reference: string) {
  return postJson<VerifyPaystackResponse>("/api/payments/monnify/verify", {
    reference,
  });
}

export function initializeBachsPayment(input: { orderId: string }) {
  return postJson<InitializePaystackResponse>(
    "/api/payments/bachs/initialize",
    input,
  );
}
export function verifyBachsPayment(reference: string) {
  return postJson<VerifyPaystackResponse>("/api/payments/bachs/verify", {
    reference,
  });
}
