/**
 * Flutterwave extension point — not fully implemented in Phase 7.
 * Wire initialize/verify here when credentials are available.
 */

export function isFlutterwaveReady() {
  return Boolean(
    process.env.FLUTTERWAVE_SECRET_KEY?.trim() &&
      process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY?.trim(),
  );
}

export async function initializeFlutterwaveTransaction(_input: {
  email: string;
  amountNaira: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; reference: string }> {
  void _input;
  throw new Error(
    "Flutterwave is not enabled yet. Use Paystack or Cash on Delivery.",
  );
}

export async function verifyFlutterwaveTransaction(_reference: string) {
  void _reference;
  throw new Error("Flutterwave verification is not implemented yet.");
}
