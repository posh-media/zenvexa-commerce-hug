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
  const response = await fetch(url, {
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
  clientPaymentLog("init.request", "Calling /api/payments/paystack/initialize", {
    orderId: input.orderId,
    hasCallback: Boolean(input.callbackUrl),
  });

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

export type CodFeeGateway = "paystack" | "korapay" | "squad" | "monnify";

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
let providerSettings: {
  monnify: boolean;
  squad: boolean;
  paystack: boolean;
  korapay: boolean;
  flutterwave: boolean;
  cod: boolean;
  codAllowedStates: string[];
} | null = null;

async function fetchProviderSettings() {
  try {
    const response = await fetch('/api/payment-settings');
    const data = await response.json();
    providerSettings = {
      ...data,
      codAllowedStates: Array.isArray(data.codAllowedStates)
        ? data.codAllowedStates
        : [],
    };
    return providerSettings;
  } catch (error) {
    console.error('Failed to fetch payment settings:', error);
    // Fallback to environment variables during migration
    providerSettings = {
      monnify: process.env.NEXT_PUBLIC_MONNIFY_ENABLED === 'true',
      squad: process.env.NEXT_PUBLIC_SQUAD_ENABLED === 'true',
      paystack: process.env.NEXT_PUBLIC_PAYSTACK_ENABLED === 'true',
      korapay: process.env.NEXT_PUBLIC_KORAPAY_ENABLED === 'true',
      flutterwave: process.env.NEXT_PUBLIC_FLUTTERWAVE_ENABLED === 'true',
      cod: process.env.NEXT_PUBLIC_COD_ENABLED !== 'false',
      codAllowedStates: [],
    };
    return providerSettings;
  }
}

export async function getPaymentProviderSettings() {
  if (!providerSettings) {
    await fetchProviderSettings();
  }
  return providerSettings!;
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
  return postJson<InitializePaystackResponse>("/api/payments/squad/initialize", input);
}

export function verifySquadPayment(reference: string) {
  return postJson<VerifyPaystackResponse>("/api/payments/squad/verify", { reference });
}

export function initializeMonnifyPayment(input: { orderId: string }) {
  return postJson<InitializePaystackResponse>("/api/payments/monnify/initialize", input);
}
export function verifyMonnifyPayment(reference: string) {
  return postJson<VerifyPaystackResponse>("/api/payments/monnify/verify", { reference });
}
