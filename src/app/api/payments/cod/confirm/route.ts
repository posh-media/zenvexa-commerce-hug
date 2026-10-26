import { NextResponse } from "next/server";
import { confirmCodBodySchema } from "@/schemas/payment.schema";
import { getCodAllowedStates, isCodEnabled } from "@/lib/server/env";
import { isCodStateAllowed } from "@/lib/cod";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { COLLECTIONS } from "@/constants/collections";
import { finalizeCashOnDelivery } from "@/lib/server/finalize-payment";
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
    key: clientKeyFromRequest(request, "cod-confirm"),
    limit: 15,
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
    if (!(await isCodEnabled())) {
      return NextResponse.json(
        { ok: false, reason: "Cash on delivery is disabled." },
        { status: 403 },
      );
    }

    const json = await request.json();
    const parsed = confirmCodBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, reason: "Invalid request body." },
        { status: 400 },
      );
    }

    // Server-side allowed-state enforcement using the stored order document.
    const orderSnap = await getAdminDb()
      .collection(COLLECTIONS.orders)
      .doc(parsed.data.orderId)
      .get();
    if (orderSnap.exists) {
      const allowedStates = await getCodAllowedStates();
      const state = (orderSnap.data()?.shippingAddress as { state?: string } | undefined)?.state;
      if (!isCodStateAllowed(allowedStates, state)) {
        const list = allowedStates.length ? allowedStates.join(", ") : "none configured";
        return NextResponse.json(
          {
            ok: false,
            reason: `Payment on delivery is only allowed in the following areas: ${list}. A 25% commitment fee is required.`,
          },
          { status: 403 },
        );
      }
    }

    const result = await finalizeCashOnDelivery(parsed.data.orderId);
    if (!result.ok) {
      reportPaymentFailure("COD confirm rejected", {
        orderId: parsed.data.orderId,
        reason: result.reason,
      });
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        paymentStatus: result.order.paymentStatus,
        orderStatus: result.order.orderStatus,
        total: result.order.total,
      },
    });
  } catch (error) {
    reportPaymentFailure("COD confirm failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        reason: publicErrorMessage(error, "Could not confirm COD order."),
      },
      { status: 500 },
    );
  }
}
