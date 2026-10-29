import { COLLECTIONS } from "@/constants/collections";
import { reportPaymentFailure } from "@/lib/monitoring";
import { verifyBachsForReference } from "@/lib/server/bachs-payment-service";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { verifyMonnifyForReference } from "@/lib/server/monnify-payment-service";
import {
  verifyKorapayForReference,
  verifyPaystackForReference,
} from "@/lib/server/payment-service";
import {
  clientKeyFromRequest,
  publicErrorMessage,
  rateLimit,
} from "@/lib/server/rate-limit";
import { verifySquadForReference } from "@/lib/server/squad-payment-service";
import { withStoreRequest } from "@/lib/server/store-request";
import { reverifyBodySchema } from "@/schemas/payment.schema";
import type { Order } from "@/types/order";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyResult =
  | Awaited<ReturnType<typeof verifyPaystackForReference>>
  | Awaited<ReturnType<typeof verifyKorapayForReference>>
  | Awaited<ReturnType<typeof verifySquadForReference>>
  | Awaited<ReturnType<typeof verifyMonnifyForReference>>
  | Awaited<ReturnType<typeof verifyBachsForReference>>;

/**
 * Order-aware manual reverification. The gateway, reference and expected
 * amount all come from the stored order/payment documents — the browser only
 * supplies the order identifier.
 */
async function handlePOST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "payments-reverify"),
    limit: 10,
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
    const parsed = reverifyBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, reason: "Enter a valid order ID." },
        { status: 400 },
      );
    }

    const orderId = parsed.data.orderId.trim();
    const db = getAdminDb();
    const normalized = orderId.toUpperCase();

    const byNumber = await db
      .collection(COLLECTIONS.orders)
      .where("orderNumber", "==", normalized)
      .limit(1)
      .get();

    let order: Order | undefined;
    if (!byNumber.empty) {
      const doc = byNumber.docs[0]!;
      order = { id: doc.id, ...doc.data() } as Order;
    } else {
      const byId = await db.collection(COLLECTIONS.orders).doc(orderId).get();
      if (byId.exists) {
        order = { id: byId.id, ...byId.data() } as Order;
      }
    }

    if (!order) {
      return NextResponse.json(
        { ok: false, reason: "No order found for that ID." },
        { status: 404 },
      );
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
        },
      });
    }

    const isCod = String(order.paymentMethod ?? "") === "cash-on-delivery";
    if (isCod && order.commitmentFeeStatus === "paid") {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        codCommitmentFee: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
        },
      });
    }

    // Resolve the authoritative gateway + reference from stored data.
    let gateway = String(order.paymentGateway ?? "");
    let reference = String(order.paymentReference ?? "");

    if ((!gateway || !reference) && order.paymentId) {
      const paymentSnap = await db
        .collection(COLLECTIONS.payments)
        .doc(order.paymentId)
        .get();
      if (paymentSnap.exists) {
        const payment = paymentSnap.data()!;
        gateway = gateway || String(payment.gateway ?? "");
        reference = reference || String(payment.reference ?? "");
      }
    }

    if (!gateway && !isCod) {
      gateway = String(order.paymentMethod ?? "");
    }
    if (gateway === "card") gateway = "paystack";

    if (
      !gateway ||
      !reference ||
      gateway === "cod" ||
      gateway === "cash-on-delivery"
    ) {
      return NextResponse.json(
        {
          ok: false,
          reason:
            "Automatic verification is unavailable for this order — no online payment is on record. Please contact support.",
        },
        { status: 400 },
      );
    }

    let result: VerifyResult;
    switch (gateway) {
      case "paystack":
        result = await verifyPaystackForReference(reference);
        break;
      case "korapay":
        result = await verifyKorapayForReference(reference);
        break;
      case "squad":
        result = await verifySquadForReference(reference);
        break;
      case "monnify":
        result = await verifyMonnifyForReference(reference);
        break;
      case "bachs":
        result = await verifyBachsForReference(reference);
        break;
      default:
        return NextResponse.json(
          {
            ok: false,
            reason: `Automatic verification is not supported for ${gateway}. Please contact support.`,
          },
          { status: 400 },
        );
    }

    if (!result.ok) {
      reportPaymentFailure("Manual reverify rejected", {
        orderId: order.id,
        gateway,
        reason: result.reason,
      });
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          status: "status" in result ? result.status : undefined,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      alreadyProcessed:
        "alreadyProcessed" in result ? result.alreadyProcessed : undefined,
      codCommitmentFee: isCod || undefined,
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        paymentStatus: result.order.paymentStatus,
        orderStatus: result.order.orderStatus,
      },
    });
  } catch (error) {
    reportPaymentFailure("Manual reverify failed", {
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

export async function POST(request: Request) {
  return withStoreRequest(request, () => handlePOST(request), {});
}
