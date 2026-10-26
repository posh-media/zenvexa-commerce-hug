import { NextResponse } from "next/server";
import { initializeCodFeeBodySchema } from "@/schemas/payment.schema";
import { initializeCodCommitmentFee } from "@/lib/server/cod-fee-service";
import { isFirebaseAdminConfigured } from "@/lib/server/firebase-admin";
import { reportPaymentFailure } from "@/lib/monitoring";
import {
  clientKeyFromRequest,
  publicErrorMessage,
  rateLimit,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "cod-fee-init"),
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
    if (!isFirebaseAdminConfigured()) {
      return NextResponse.json(
        { ok: false, reason: "Payment verification is not configured on the server." },
        { status: 503 },
      );
    }

    const json = await request.json();
    const parsed = initializeCodFeeBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, reason: "Invalid request body." },
        { status: 400 },
      );
    }

    const result = await initializeCodCommitmentFee({
      orderId: parsed.data.orderId,
      gateway: parsed.data.gateway,
    });
    if (!result.ok) {
      reportPaymentFailure("COD fee initialize rejected", {
        orderId: parsed.data.orderId,
        gateway: parsed.data.gateway,
        reason: result.reason,
      });
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      orderId: result.orderId,
      orderNumber: result.orderNumber ?? null,
      commitmentFee: result.commitmentFee,
    });
  } catch (error) {
    reportPaymentFailure("COD fee initialize failed", {
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
