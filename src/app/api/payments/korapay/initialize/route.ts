import { NextResponse } from "next/server";
import { initializePaystackBodySchema } from "@/schemas/payment.schema";
import { initializeKorapayForOrder } from "@/lib/server/payment-service";
import { reportPaymentFailure } from "@/lib/monitoring";
import {
  clientKeyFromRequest,
  publicErrorMessage,
  rateLimit,
} from "@/lib/server/rate-limit";
import { isKorapayConfigured, isKorapayEnabled } from "@/lib/server/env";
import { isFirebaseAdminConfigured } from "@/lib/server/firebase-admin";
import { paymentLog } from "@/lib/server/payment-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "korapay-init"),
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, reason: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000) || 1),
        },
      },
    );
  }

  try {
    const json = await request.json();
    console.log("[KoraPay Initialize API] Request received", json);
    
    const parsed = initializePaystackBodySchema.safeParse(json);
    if (!parsed.success) {
      console.error("[KoraPay Initialize API] Invalid body", parsed.error);
      paymentLog("init.failure", "Invalid initialize body", {});
      return NextResponse.json(
        { ok: false, reason: "Invalid request body." },
        { status: 400 },
      );
    }

    paymentLog("init.request", "KoraPay Initialize API called", {
      orderId: parsed.data.orderId,
      hasCallback: Boolean(parsed.data.callbackUrl),
      adminConfigured: isFirebaseAdminConfigured(),
      korapayConfigured: isKorapayConfigured(),
      korapayEnabled: isKorapayEnabled(),
    });

    console.log("[KoraPay Initialize API] Configuration check", {
      adminConfigured: isFirebaseAdminConfigured(),
      korapayConfigured: isKorapayConfigured(),
      korapayEnabled: isKorapayEnabled(),
    });

    if (!isFirebaseAdminConfigured() || !isKorapayConfigured() || !isKorapayEnabled()) {
      console.error("[KoraPay Initialize API] Configuration failed");
      paymentLog("init.failure", "KoraPay not configured or disabled", {});
      return NextResponse.json(
        { ok: false, reason: "KoraPay is not configured or is currently disabled." },
        { status: 503 },
      );
    }

    paymentLog("init.admin", "Using Firebase Admin + KoraPay secret", {
      orderId: parsed.data.orderId,
    });

    console.log("[KoraPay Initialize API] Calling initializeKorapayForOrder");
    const result = await initializeKorapayForOrder({
      orderId: parsed.data.orderId,
      callbackUrl: parsed.data.callbackUrl,
    });

    console.log("[KoraPay Initialize API] Result", { ok: result.ok, reason: result.reason });

    if (!result.ok) {
      paymentLog("init.failure", "KoraPay initialize failed", {
        orderId: parsed.data.orderId,
        reason: result.reason,
      });
      return NextResponse.json(result, { status: 400 });
    }

    paymentLog("init.success", "KoraPay initialize succeeded", {
      orderId: result.orderId,
      reference: result.reference,
    });

    return NextResponse.json({
      ok: true,
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      paymentId: result.paymentId,
    });
  } catch (error) {
    console.error("[KoraPay Initialize API] Error", error);
    reportPaymentFailure("KoraPay initialize failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        reason: publicErrorMessage(error, "Could not initialize payment."),
      },
      { status: 500 },
    );
  }
}
