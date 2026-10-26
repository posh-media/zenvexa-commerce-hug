import { createHmac, timingSafeEqual } from "crypto";
import {
  fromKobo,
  getPaystackSecretKey,
  getPaystackWebhookSecret,
  toKobo,
} from "@/lib/server/env";
import type { NormalizedPaymentResult } from "@/types/payment";

const PAYSTACK_BASE = "https://api.paystack.co";

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

export type PaystackInitializeResult = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export type PaystackVerifyData = {
  id: number;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel?: string;
  paid_at?: string;
  created_at?: string;
  gateway_response?: string;
  customer?: {
    email?: string;
    customer_code?: string;
  };
  authorization?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

async function paystackFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<PaystackResponse<T>> {
  const secret = await getPaystackSecretKey();
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let body: PaystackResponse<T>;
  try {
    body = (await response.json()) as PaystackResponse<T>;
  } catch {
    throw new Error("Paystack returned an invalid response.");
  }

  if (!response.ok || !body.status) {
    throw new Error(body.message || `Paystack error (${response.status}).`);
  }
  return body;
}

export async function initializePaystackTransaction(input: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitializeResult> {
  const amountKobo = toKobo(input.amountNaira);
  if (amountKobo < 100) {
    throw new Error("Order total is too small to charge.");
  }

  const result = await paystackFetch<PaystackInitializeResult>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: amountKobo,
        reference: input.reference,
        currency: "NGN",
        callback_url: input.callbackUrl,
        metadata: {
          ...input.metadata,
          cancel_action: `${input.callbackUrl.split("?")[0]}?cancelled=1&reference=${encodeURIComponent(input.reference)}`,
        },
      }),
    },
  );

  return result.data;
}

export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackVerifyData> {
  const encoded = encodeURIComponent(reference.trim());
  const result = await paystackFetch<PaystackVerifyData>(
    `/transaction/verify/${encoded}`,
  );
  return result.data;
}

export function mapPaystackStatus(
  status: string,
): NormalizedPaymentResult["status"] {
  const normalized = status.toLowerCase();
  if (normalized === "success") return "paid";
  if (normalized === "failed") return "failed";
  if (normalized === "abandoned") return "cancelled";
  if (normalized === "reversed") return "refunded";
  if (normalized === "ongoing" || normalized === "processing") {
    return "processing";
  }
  return "pending";
}

export function normalizePaystackVerification(
  data: PaystackVerifyData,
): NormalizedPaymentResult {
  return {
    reference: data.reference,
    status: mapPaystackStatus(data.status),
    amount: fromKobo(data.amount),
    currency: data.currency || "NGN",
    gateway: "paystack",
    paidAt: data.paid_at,
    channel: data.channel,
    customerEmail: data.customer?.email,
    gatewayResponse: data as unknown as Record<string, unknown>,
    authorization: data.authorization,
  };
}

/** Validate Paystack webhook signature (x-paystack-signature). */
export async function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const secret = await getPaystackWebhookSecret();
  if (!secret) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  try {
    const expected = Buffer.from(hash, "utf8");
    const received = Buffer.from(signature, "utf8");
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export function amountsMatch(
  expectedNaira: number,
  paidKobo: number,
  toleranceKobo = 0,
): boolean {
  const expectedKobo = toKobo(expectedNaira);
  return Math.abs(expectedKobo - paidKobo) <= toleranceKobo;
}
