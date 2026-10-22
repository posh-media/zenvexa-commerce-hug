import { NextResponse } from "next/server";
import { getAppSettings } from "@/services/settings.service";
import {
  getAdminDb,
  isFirebaseAdminConfigured,
} from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** True when a secret key exists — the value itself is never exposed. */
async function secretConfigured(
  provider: "paystack" | "korapay" | "flutterwave",
  legacyKey: string | undefined,
  envKey: string | undefined,
) {
  if (isFirebaseAdminConfigured()) {
    try {
      const snap = await getAdminDb()
        .collection("privatePaymentSettings")
        .doc(provider)
        .get();
      if (typeof snap.data()?.secretKey === "string" && snap.data()!.secretKey) {
        return true;
      }
    } catch {
      // Fall through to legacy/env checks.
    }
  }
  return Boolean(legacyKey || envKey);
}

export async function GET() {
  try {
    const settings = await getAppSettings();

    const [paystackKeyConfigured, korapayKeyConfigured, flutterwaveKeyConfigured] =
      await Promise.all([
        secretConfigured(
          "paystack",
          settings?.paymentSecrets?.paystackSecretKey,
          process.env.PAYSTACK_SECRET_KEY,
        ),
        secretConfigured(
          "korapay",
          settings?.paymentSecrets?.korapaySecretKey,
          process.env.KORAPAY_SECRET_KEY,
        ),
        secretConfigured(
          "flutterwave",
          settings?.paymentSecrets?.flutterwaveSecretKey,
          process.env.FLUTTERWAVE_SECRET_KEY,
        ),
      ]);

    // Return only the public payment settings (no secrets)
    const publicSettings = {
      monnify: settings?.payments?.monnifyEnabled ?? process.env.NEXT_PUBLIC_MONNIFY_ENABLED === "true",
      squad: settings?.payments?.squadEnabled ?? process.env.NEXT_PUBLIC_SQUAD_ENABLED === "true",
      paystack: settings?.payments?.paystackEnabled ?? 
                process.env.NEXT_PUBLIC_PAYSTACK_ENABLED === 'true',
      korapay: settings?.payments?.korapayEnabled ?? 
               process.env.NEXT_PUBLIC_KORAPAY_ENABLED === 'true',
      flutterwave: settings?.payments?.flutterwaveEnabled ?? 
                   process.env.NEXT_PUBLIC_FLUTTERWAVE_ENABLED === 'true',
      cod: settings?.payments?.codEnabled ?? 
           process.env.NEXT_PUBLIC_COD_ENABLED !== 'false',
      codAllowedStates: Array.isArray(settings?.payments?.paymentOnDeliveryAllowedStates)
        ? settings.payments.paymentOnDeliveryAllowedStates
            .map((s) => String(s ?? "").trim())
            .filter(Boolean)
        : [],
      paystackKeyConfigured,
      korapayKeyConfigured,
      flutterwaveKeyConfigured,
    };
    
    return NextResponse.json(publicSettings);
  } catch (error) {
    console.error("[PaymentSettings] Error:", error);
    return NextResponse.json(
      { 
        monnify: process.env.NEXT_PUBLIC_MONNIFY_ENABLED === "true",
        squad: process.env.NEXT_PUBLIC_SQUAD_ENABLED === "true",
        paystack: process.env.NEXT_PUBLIC_PAYSTACK_ENABLED === 'true',
        korapay: process.env.NEXT_PUBLIC_KORAPAY_ENABLED === 'true',
        flutterwave: process.env.NEXT_PUBLIC_FLUTTERWAVE_ENABLED === 'true',
        cod: process.env.NEXT_PUBLIC_COD_ENABLED !== 'false',
        codAllowedStates: [],
        paystackKeyConfigured: false,
        korapayKeyConfigured: false,
        flutterwaveKeyConfigured: false,
      },
      { status: 200 }
    );
  }
}
