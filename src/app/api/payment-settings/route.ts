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
  provider: "paystack" | "korapay" | "flutterwave" | "bachs",
  legacyKey: string | undefined,
  envKey: string | undefined,
) {
  if (isFirebaseAdminConfigured()) {
    try {
      const snap = await getAdminDb()
        .collection("privatePaymentSettings")
        .doc(provider)
        .get();
      const data = snap.data();
      if (provider === "bachs") {
        if (
          [data?.sandboxApiKey, data?.liveApiKey].some(
            (k) => typeof k === "string" && k,
          )
        ) {
          return true;
        }
      } else if (typeof data?.secretKey === "string" && data.secretKey) {
        return true;
      }
    } catch {
      // Fall through to legacy/env checks.
    }
  }
  return Boolean(legacyKey || envKey);
}

/** Which named fields of a private settings doc contain values. */
async function privateFieldsConfigured(
  provider: "squad" | "monnify" | "bachs",
  fields: string[],
  envFallbacks: Record<string, string | undefined> = {},
) {
  const result: Record<string, boolean> = {};
  let data: Record<string, unknown> | undefined;
  if (isFirebaseAdminConfigured()) {
    try {
      data = (
        await getAdminDb()
          .collection("privatePaymentSettings")
          .doc(provider)
          .get()
      ).data();
    } catch {
      data = undefined;
    }
  }
  for (const field of fields) {
    result[field] = Boolean(
      (typeof data?.[field] === "string" && data[field]) ||
        envFallbacks[field],
    );
  }
  return result;
}

export async function GET() {
  try {
    const settings = await getAppSettings();

    const [
      paystackKeyConfigured,
      korapayKeyConfigured,
      flutterwaveKeyConfigured,
      bachsKeyConfigured,
      squadKeyConfigured,
      monnifyKeyConfigured,
      bachsFieldsConfigured,
    ] =
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
        secretConfigured(
          "bachs",
          undefined,
          process.env.BACHS_SANDBOX_API_KEY || process.env.BACHS_LIVE_API_KEY,
        ),
        privateFieldsConfigured(
          "squad",
          ["sandboxSecretKey", "liveSecretKey"],
          {
            sandboxSecretKey: process.env.SQUAD_TEST_SECRET_KEY,
            liveSecretKey: process.env.SQUAD_LIVE_SECRET_KEY,
          },
        ),
        privateFieldsConfigured(
          "monnify",
          [
            "sandboxApiKey",
            "sandboxSecretKey",
            "sandboxContractCode",
            "liveApiKey",
            "liveSecretKey",
            "liveContractCode",
          ],
        ),
        privateFieldsConfigured(
          "bachs",
          [
            "sandboxApiKey",
            "liveApiKey",
            "sandboxWebhookSecret",
            "liveWebhookSecret",
          ],
          {
            sandboxApiKey: process.env.BACHS_SANDBOX_API_KEY,
            liveApiKey: process.env.BACHS_LIVE_API_KEY,
            sandboxWebhookSecret: process.env.BACHS_SANDBOX_WEBHOOK_SECRET,
            liveWebhookSecret: process.env.BACHS_LIVE_WEBHOOK_SECRET,
          },
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
      bachs: settings?.payments?.bachsEnabled ??
             process.env.NEXT_PUBLIC_BACHS_ENABLED === 'true',
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
      bachsKeyConfigured,
      squadKeyConfigured,
      monnifyKeyConfigured,
      bachsFieldsConfigured,
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
        bachs: process.env.NEXT_PUBLIC_BACHS_ENABLED === 'true',
        cod: process.env.NEXT_PUBLIC_COD_ENABLED !== 'false',
        codAllowedStates: [],
        paystackKeyConfigured: false,
        korapayKeyConfigured: false,
        flutterwaveKeyConfigured: false,
        bachsKeyConfigured: false,
        squadKeyConfigured: {},
        monnifyKeyConfigured: {},
        bachsFieldsConfigured: {},
      },
      { status: 200 }
    );
  }
}
