import { NextResponse } from "next/server";
import { verifyPaystackBodySchema } from "@/schemas/payment.schema";
import { verifyKorapayForReference } from "@/lib/server/payment-service";
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
    key: clientKeyFromRequest(request, "korapay-verify"),
    limit: 30,
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
    const parsed = verifyPaystackBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, reason: "Invalid payment reference." },
        { status: 400 },
      );
    }

    const result = await verifyKorapayForReference(parsed.data.reference);
    if (!result.ok) {
      reportPaymentFailure("KoraPay verify rejected", {
        reference: parsed.data.reference,
        reason: result.reason,
      });
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      reference: result.reference,
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        paymentStatus: result.order.paymentStatus,
        orderStatus: result.order.orderStatus,
        total: result.order.total,
      },
      payment: {
        reference: result.payment.reference,
        status: result.payment.status,
        amount: result.payment.amount,
        currency: result.payment.currency,
      },
    });
  } catch (error) {
    reportPaymentFailure("KoraPay verify failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        reason: publicErrorMessage(error, "Could not verify payment."),
      },
      { status: 500 },
    );
  }
}
