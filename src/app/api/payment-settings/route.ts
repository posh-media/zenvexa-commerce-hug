import { NextResponse } from "next/server";
import { getAppSettings } from "@/services/settings.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getAppSettings();
    
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
      },
      { status: 200 }
    );
  }
}
