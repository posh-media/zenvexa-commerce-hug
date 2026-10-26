import { createHmac, timingSafeEqual } from "node:crypto";
import type { NormalizedPaymentResult } from "@/types/payment";

export type SquadCredentials = { secretKey: string; sandbox: boolean };
export type SquadVerification = {
  transaction_amount: number;
  transaction_ref: string;
  transaction_status: string;
  transaction_currency_id: string;
  email?: string;
  transaction_type?: string;
};

async function squadFetch<T>(
  config: SquadCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!config.secretKey) throw new Error("Squad is not configured.");
  const base = config.sandbox
    ? "https://sandbox-api-d.squadco.com"
    : "https://api-d.squadco.com";
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json()) as {
    status?: number;
    success?: boolean;
    data?: T;
  };
  // The documented initialize response has status: 200 without a success flag.
  if (
    !response.ok ||
    body.success === false ||
    (body.success !== true && body.status !== 200) ||
    !body.data
  ) {
    throw new Error(
      "Squad could not process this request. Please try again shortly.",
    );
  }
  return body.data;
}

export async function initializeSquadTransaction(
  config: SquadCredentials,
  input: {
    email: string;
    customerName?: string;
    amount: number;
    reference: string;
    callbackUrl: string;
    metadata: Record<string, unknown>;
  },
) {
  const amountKobo = Math.round(input.amount * 100);
  if (!Number.isSafeInteger(amountKobo) || amountKobo < 100)
    throw new Error("Order total is invalid.");
  const data = await squadFetch<{
    checkout_url: string;
    transaction_ref?: string;
  }>(config, "/transaction/initiate", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      customer_name: input.customerName,
      amount: amountKobo,
      currency: "NGN",
      initiate_type: "inline",
      transaction_ref: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      pass_charge: false,
    }),
  });
  const checkout = new URL(data.checkout_url);
  if (
    checkout.protocol !== "https:" ||
    !(
      checkout.hostname === "squadco.com" ||
      checkout.hostname.endsWith(".squadco.com")
    )
  ) {
    throw new Error("Squad returned an invalid checkout URL.");
  }
  if (data.transaction_ref && data.transaction_ref !== input.reference)
    throw new Error("Squad returned an unexpected reference.");
  return { authorizationUrl: checkout.toString(), reference: input.reference };
}

export function verifySquadTransaction(
  config: SquadCredentials,
  reference: string,
) {
  return squadFetch<SquadVerification>(
    config,
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
}

export function normalizeSquadVerification(
  data: SquadVerification,
): NormalizedPaymentResult {
  const status = data.transaction_status?.toLowerCase();
  return {
    gateway: "squad",
    reference: data.transaction_ref,
    amount: Number(data.transaction_amount) / 100,
    currency: data.transaction_currency_id,
    status:
      status === "success"
        ? "paid"
        : status === "failed"
          ? "failed"
          : status === "abandoned"
            ? "cancelled"
            : "processing",
    customerEmail: data.email,
    channel: data.transaction_type,
    gatewayResponse: data as unknown as Record<string, unknown>,
  };
}

export function validateSquadPayment(
  data: SquadVerification,
  expected: { reference: string; amount: number; email?: string },
) {
  if (data.transaction_ref !== expected.reference)
    return "Payment reference does not match.";
  if (
    !Number.isSafeInteger(Number(data.transaction_amount)) ||
    Number(data.transaction_amount) !== Math.round(expected.amount * 100)
  )
    return "Paid amount does not match the order total.";
  if (data.transaction_currency_id?.toUpperCase() !== "NGN")
    return "Unsupported payment currency.";
  if (
    expected.email &&
    data.email &&
    expected.email.trim().toLowerCase() !== data.email.trim().toLowerCase()
  )
    return "Payment customer does not match the order.";
  return null;
}

/** Hosted checkout uses x-squad-encrypted-body, not the virtual-account signature. */
export function verifySquadWebhookSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string,
) {
  if (!secretKey || !signature || !/^[a-f0-9]{128}$/i.test(signature))
    return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
