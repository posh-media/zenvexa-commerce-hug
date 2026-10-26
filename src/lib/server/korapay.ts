import { createHmac, timingSafeEqual } from "crypto";
import {
  getKorapaySecretKey,
} from "@/lib/server/env";
import type { NormalizedPaymentResult } from "@/types/payment";

const KORAPAY_BASE = "https://api.korapay.com/merchant/api/v1";

type KorapayResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

export type KorapayInitializeResult = {
  checkout_url: string;
  reference: string;
};

export type KorapayVerifyData = {
  id: string;
  status: string;
  reference: string;
  amount: number;
  currency: string;
  customer?: {
    name?: string;
    email?: string;
  };
  fees?: number;
  merchant_fee?: number;
  settlement_amount?: number;
  created_at?: string;
  paid_at?: string;
  metadata?: Record<string, unknown>;
};

async function korapayFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<KorapayResponse<T>> {
  const secret = await getKorapaySecretKey();
  console.log("[korapayFetch] Making request", { 
    path, 
    hasSecret: Boolean(secret),
    url: `${KORAPAY_BASE}${path}`
  });
  
  const response = await fetch(`${KORAPAY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  console.log("[korapayFetch] Response status", { 
    status: response.status, 
    ok: response.ok 
  });

  let body: KorapayResponse<T>;
  try {
    body = (await response.json()) as KorapayResponse<T>;
    console.log("[korapayFetch] Response body", { 
      status: body.status, 
      message: body.message 
    });
  } catch (error) {
    console.error("[korapayFetch] Failed to parse response", error);
    throw new Error("KoraPay returned an invalid response.");
  }

  if (!response.ok || !body.status) {
    console.error("[korapayFetch] KoraPay error", { 
      status: response.status, 
      bodyStatus: body.status, 
      message: body.message 
    });
    throw new Error(body.message || `KoraPay error (${response.status}).`);
  }
  return body;
}

export async function initializeKorapayTransaction(input: {
  email: string;
  amountNaira: number;
  reference: string;
  redirectUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<KorapayInitializeResult> {
  console.log("[initializeKorapayTransaction] Starting", {
    email: input.email,
    amountNaira: input.amountNaira,
    reference: input.reference,
    redirectUrl: input.redirectUrl,
  });

  // KoraPay expects amount in Naira, not kobo (unlike Paystack)
  const amountNaira = input.amountNaira;
  if (amountNaira < 1) {
    console.error("[initializeKorapayTransaction] Amount too small", { amountNaira });
    throw new Error("Order total is too small to charge.");
  }

  const requestBody = {
    amount: amountNaira,
    currency: "NGN",
    reference: input.reference,
    customer: {
      name: input.metadata?.customerName as string || "",
      email: input.email,
    },
    redirect_url: input.redirectUrl,
    metadata: input.metadata,
  };

  console.log("[initializeKorapayTransaction] Request body", requestBody);

  const result = await korapayFetch<KorapayInitializeResult>(
    "/charges/initialize",
    {
      method: "POST",
      body: JSON.stringify(requestBody),
    },
  );

  console.log("[initializeKorapayTransaction] Success", {
    checkoutUrl: result.data.checkout_url,
    reference: result.data.reference,
  });

  return result.data;
}

export async function verifyKorapayTransaction(
  reference: string,
): Promise<KorapayVerifyData> {
  console.log("[verifyKorapayTransaction] Starting verification", { reference });
  
  const result = await korapayFetch<KorapayVerifyData>(
    `/charges/${reference}`,
  );
  
  console.log("[verifyKorapayTransaction] KoraPay verification successful", {
    reference,
    status: result.data.status,
    amount: result.data.amount,
    currency: result.data.currency,
    korapayReference: result.data.reference,
    metadata: result.data.metadata,
  });
  
  return result.data;
}

export function mapKorapayStatus(
  status: string,
): NormalizedPaymentResult["status"] {
  const normalized = status.toLowerCase();
  if (normalized === "success" || normalized === "successful") return "paid";
  if (normalized === "failed" || normalized === "failure") return "failed";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "refunded") return "refunded";
  if (normalized === "pending" || normalized === "processing") {
    return "processing";
  }
  return "pending";
}

export function normalizeKorapayVerification(
  data: KorapayVerifyData,
): NormalizedPaymentResult {
  return {
    reference: data.reference,
    status: mapKorapayStatus(data.status),
    amount: data.amount, // KoraPay returns amount in Naira, not kobo
    currency: data.currency || "NGN",
    gateway: "korapay",
    paidAt: data.paid_at,
    customerEmail: data.customer?.email,
    gatewayResponse: data as unknown as Record<string, unknown>,
  };
}

/** Validate KoraPay webhook signature (x-korapay-signature). */
export async function verifyKorapayWebhookSignature(
  payload: { data?: unknown },
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const secret = await getKorapaySecretKey();
  if (!secret) return false;
  
  // KoraPay signature is HMAC-SHA256 of the data object only (per official docs)
  const dataString = JSON.stringify(payload.data);
  const hash = createHmac("sha256", secret).update(dataString).digest("hex");
  try {
    const expected = Buffer.from(hash, "utf8");
    const provided = Buffer.from(signature, "utf8");
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

export function amountsMatch(
  expectedNaira: number,
  paidNaira: number,
): boolean {
  // KoraPay uses Naira directly, so compare Naira amounts
  return Math.abs(expectedNaira - paidNaira) < 1; // Allow 1 Naira tolerance
}

/**
 * IMPORTANT: KoraPay vs Paystack amount handling
 * 
 * Paystack: Requires amounts in kobo (Naira * 100)
 * KoraPay: Requires amounts in Naira directly
 * 
 * This file handles KoraPay's Naira-based amounts internally.
 * The toKobo/fromKobo functions are imported from env.ts for Paystack compatibility
 * but are NOT used for KoraPay operations.
 */
