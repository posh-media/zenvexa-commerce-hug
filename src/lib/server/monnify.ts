import { createHmac, timingSafeEqual } from "node:crypto";
import type { NormalizedPaymentResult } from "@/types/payment";

export type MonnifyCredentials = {
  apiKey: string;
  secretKey: string;
  contractCode: string;
  sandbox: boolean;
};
export type MonnifyVerification = {
  paymentReference: string;
  transactionReference: string;
  amountPaid: number | string;
  paymentStatus: string;
  currencyCode?: string;
  currency?: string;
  paymentMethod?: string;
  paidOn?: string;
  customerDTO?: { email?: string };
  customer?: { email?: string };
};

async function request<T>(
  config: MonnifyCredentials,
  path: string,
  init: RequestInit,
): Promise<T> {
  const base = config.sandbox
    ? "https://sandbox.monnify.com"
    : "https://api.monnify.com";
  const response = await fetch(base + path, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json()) as {
    requestSuccessful?: boolean;
    responseBody?: T;
  };
  if (!response.ok || body.requestSuccessful !== true || !body.responseBody)
    throw new Error(
      "Monnify could not process this request. Please try again shortly.",
    );
  return body.responseBody;
}

async function authenticatedRequest<T>(
  config: MonnifyCredentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!config.apiKey || !config.secretKey)
    throw new Error("Monnify is not configured.");
  const auth = await request<{ accessToken: string }>(
    config,
    "/api/v1/auth/login",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.secretKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!auth.accessToken || typeof auth.accessToken !== "string")
    throw new Error("Monnify authentication failed.");
  return request<T>(config, path, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

export async function initializeMonnifyTransaction(
  config: MonnifyCredentials,
  input: {
    email: string;
    customerName?: string;
    amount: number;
    reference: string;
    callbackUrl: string;
    metadata: Record<string, unknown>;
  },
) {
  if (!config.contractCode)
    throw new Error("Monnify contract code is not configured.");
  const kobo = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(kobo) || kobo < 100)
    throw new Error("Order total is invalid.");
  const data = await authenticatedRequest<{
    checkoutUrl: string;
    paymentReference: string;
    transactionReference: string;
  }>(config, "/api/v1/merchant/transactions/init-transaction", {
    method: "POST",
    body: JSON.stringify({
      amount: kobo / 100,
      customerName: input.customerName || input.email,
      customerEmail: input.email,
      paymentReference: input.reference,
      paymentDescription: "ShopBeta order payment",
      currencyCode: "NGN",
      contractCode: config.contractCode,
      redirectUrl: input.callbackUrl,
      // Omit paymentMethods to let the merchant's enabled Monnify methods appear.
    }),
  });
  const checkout = new URL(data.checkoutUrl);
  if (
    checkout.protocol !== "https:" ||
    !(
      checkout.hostname === "monnify.com" ||
      checkout.hostname.endsWith(".monnify.com")
    ) ||
    checkout.username ||
    checkout.password
  )
    throw new Error("Monnify returned an invalid checkout URL.");
  if (data.paymentReference !== input.reference || !data.transactionReference)
    throw new Error("Monnify returned an unexpected reference.");
  return {
    authorizationUrl: checkout.toString(),
    reference: input.reference,
    transactionReference: data.transactionReference,
  };
}

export function verifyMonnifyTransaction(
  config: MonnifyCredentials,
  reference: string,
) {
  return authenticatedRequest<MonnifyVerification>(
    config,
    `/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(reference)}`,
  );
}

export function normalizeMonnifyVerification(
  data: MonnifyVerification,
): NormalizedPaymentResult {
  const status = data.paymentStatus?.toUpperCase();
  return {
    gateway: "monnify",
    reference: data.paymentReference,
    amount: Number(data.amountPaid),
    currency: data.currencyCode || data.currency || "",
    status:
      status === "PAID"
        ? "paid"
        : ["FAILED", "REVERSED", "EXPIRED"].includes(status)
          ? "failed"
          : status === "CANCELLED"
            ? "cancelled"
            : "processing",
    customerEmail: data.customerDTO?.email || data.customer?.email,
    channel: data.paymentMethod,
    gatewayResponse: data as unknown as Record<string, unknown>,
  };
}

export function validateMonnifyPayment(
  data: MonnifyVerification,
  expected: {
    reference: string;
    transactionReference?: string;
    amount: number;
    email?: string;
  },
) {
  if (
    data.paymentReference !== expected.reference ||
    !data.transactionReference ||
    (expected.transactionReference &&
      data.transactionReference !== expected.transactionReference)
  )
    return "Payment reference does not match.";
  const amount = Number(data.amountPaid);
  if (
    !Number.isFinite(amount) ||
    !Number.isSafeInteger(Math.round(amount * 100)) ||
    Math.round(amount * 100) !== Math.round(expected.amount * 100)
  )
    return "Paid amount does not match the order total.";
  if ((data.currencyCode || data.currency)?.toUpperCase() !== "NGN")
    return "Unsupported payment currency.";
  const email = data.customerDTO?.email || data.customer?.email;
  if (
    expected.email &&
    email &&
    expected.email.trim().toLowerCase() !== email.trim().toLowerCase()
  )
    return "Payment customer does not match the order.";
  return null;
}

export function verifyMonnifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string,
) {
  if (!secretKey || !signature || !/^[a-f0-9]{128}$/i.test(signature))
    return false;
  return timingSafeEqual(
    createHmac("sha512", secretKey).update(rawBody).digest(),
    Buffer.from(signature, "hex"),
  );
}
