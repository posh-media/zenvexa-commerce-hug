import { createHmac, timingSafeEqual } from "node:crypto";
import type { NormalizedPaymentResult } from "@/types/payment";

export type BachsCredentials = {
  apiKey: string;
  webhookSecret: string;
  sandbox: boolean;
};

/** https://docs.bachs.io — decimal-string money, Bearer sk_ keys. */
async function bachsFetch<T>(
  config: BachsCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!config.apiKey) throw new Error("Bachs is not configured.");
  const base = config.sandbox
    ? "https://sandbox-api.bachs.io"
    : "https://api.bachs.io";
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json().catch(() => null)) as
    | ({ detail?: string; error_code?: string } & Record<string, unknown>)
    | null;
  if (!response.ok || !body) {
    throw new Error(
      "Bachs could not process this request. Please try again shortly.",
    );
  }
  return body as T;
}

export type BachsCheckoutSession = {
  checkout_id: string;
  checkout_url: string;
  status: "open" | "completed" | "expired" | "cancelled";
  expires_at?: string;
  created_at?: string;
  reference?: string | null;
};

export async function createBachsCheckoutSession(
  config: BachsCredentials,
  input: {
    email: string;
    customerName?: string;
    phone?: string;
    /** Decimal-string amount in `currency` major units (e.g. "75000.00"). */
    amount: string;
    currency: string;
    reference: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, unknown>;
    idempotencyKey: string;
  },
) {
  const amountNumber = Number(input.amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0)
    throw new Error("Order total is invalid.");
  const session = await bachsFetch<BachsCheckoutSession>(
    config,
    "/v1/checkout-sessions",
    {
      method: "POST",
      headers: { "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({
        pricing: {
          currency: input.currency,
          amount: input.amount,
          price_type: "fixed",
        },
        customer: {
          email: input.email,
          name: input.customerName || undefined,
          phone_number: input.phone || undefined,
        },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        reference: input.reference,
        metadata: input.metadata,
      }),
    },
  );
  if (!session.checkout_id || !session.checkout_url)
    throw new Error("Bachs returned an invalid checkout session.");
  const url = new URL(session.checkout_url);
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "bachs.io" || url.hostname.endsWith(".bachs.io"))
  ) {
    throw new Error("Bachs returned an invalid checkout URL.");
  }
  if (session.reference && session.reference !== input.reference)
    throw new Error("Bachs returned an unexpected reference.");
  return {
    checkoutId: session.checkout_id,
    checkoutUrl: url.toString(),
    status: session.status,
    expiresAt: session.expires_at,
  };
}

export function getBachsCheckoutSession(
  config: BachsCredentials,
  checkoutId: string,
) {
  return bachsFetch<
    BachsCheckoutSession & {
      pricing?: { amount?: string; currency?: string };
      total_amount?: string;
      amount?: string;
      customer_details?: { email?: string; name?: string } | null;
    }
  >(config, `/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`);
}

export function normalizeBachsCheckout(
  session: BachsCheckoutSession,
  reference: string,
): NormalizedPaymentResult {
  return {
    gateway: "bachs",
    reference,
    amount: 0,
    currency: "NGN",
    status:
      session.status === "completed"
        ? "paid"
        : session.status === "expired"
          ? "failed"
          : session.status === "cancelled"
            ? "cancelled"
            : "processing",
    gatewayResponse: session as unknown as Record<string, unknown>,
  };
}

/**
 * Verify a Bachs webhook delivery.
 * X-Bachs-Signature:    HMAC-SHA256 hex of "{timestamp}.{raw_body}"
 * X-Bachs-Signature-V2: "t={timestamp},v1={signature}" (accept any v1)
 * Reject events older than `toleranceSeconds` (replay protection).
 */
export function verifyBachsWebhookSignature(
  rawBody: string,
  headers: {
    signature?: string | null;
    signatureV2?: string | null;
    timestamp?: string | null;
  },
  secrets: string[],
  toleranceSeconds = 300,
) {
  const validSecrets = secrets.map((s) => s.trim()).filter(Boolean);
  if (!validSecrets.length) return false;

  let timestamp = headers.timestamp?.trim() ?? "";
  const signatures: string[] = [];
  if (headers.signatureV2) {
    for (const part of headers.signatureV2.split(",")) {
      const [key, value] = part.split("=", 2);
      if (key === "t" && value) timestamp = value.trim();
      if (key === "v1" && value) signatures.push(value.trim());
    }
  }
  if (headers.signature) signatures.push(headers.signature.trim());
  if (!timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;

  const sentAt = Number(timestamp);
  if (Math.abs(Math.floor(Date.now() / 1000) - sentAt) > toleranceSeconds)
    return false;

  const payload = `${timestamp}.${rawBody}`;
  for (const secret of validSecrets) {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    for (const signature of signatures) {
      if (!/^[a-f0-9]{64}$/i.test(signature)) continue;
      if (timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex")))
        return true;
    }
  }
  return false;
}
