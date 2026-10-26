import { NextResponse } from "next/server";
import { COLLECTIONS } from "@/constants/collections";
import {
  isFirebaseAdminConfigured,
  getAdminDb,
} from "@/lib/server/firebase-admin";
import {
  isTransactionalEmailType,
  sendTransactionalEmail,
} from "@/lib/server/transactional-email";
import type { Order } from "@/types/order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeMessage(code?: string, reason?: string) {
  switch (code) {
    case "not_configured":
      return "Transactional email service is not configured.";
    case "webhook_rejected":
      return "The email automation service rejected the request. Please try again.";
    case "missing_recipient":
      return "The order does not have a recipient email address.";
    default:
      return reason
        ? `Failed to send order email. ${reason.slice(0, 120)}`
        : "Failed to send order email. Please try again.";
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, message: "Invalid request body." },
        { status: 400 },
      );
    }

    const { emailType, orderId, recipientOverride } = body as {
      emailType?: unknown;
      orderId?: unknown;
      order?: unknown;
      recipientOverride?: unknown;
    };

    if (!isTransactionalEmailType(emailType)) {
      return NextResponse.json(
        { ok: false, message: "Unsupported email type." },
        { status: 400 },
      );
    }
    if (typeof orderId !== "string" || !orderId.trim()) {
      return NextResponse.json(
        { ok: false, message: "Missing orderId." },
        { status: 400 },
      );
    }

    // Prefer authoritative server-side order fetch when Admin SDK is configured;
    // otherwise use the order object provided by the authenticated admin client.
    let order: Order | undefined;
    if (isFirebaseAdminConfigured()) {
      const snap = await getAdminDb()
        .collection(COLLECTIONS.orders)
        .doc(orderId)
        .get();
      if (!snap.exists) {
        return NextResponse.json(
          { ok: false, message: "Order not found." },
          { status: 404 },
        );
      }
      order = { id: snap.id, ...(snap.data() as Omit<Order, "id">) };
    } else {
      const clientOrder = (body as { order?: Order }).order;
      if (!clientOrder || typeof clientOrder !== "object") {
        return NextResponse.json(
          { ok: false, message: "Order data unavailable." },
          { status: 400 },
        );
      }
      order = { ...clientOrder, id: orderId };
    }

    if (order.paymentStatus !== "paid") {
      return NextResponse.json(
        { ok: false, message: "Cannot send email for unpaid order." },
        { status: 400 },
      );
    }

    const result = await sendTransactionalEmail({
      emailType,
      order,
      reference: order.paymentReference,
      recipientOverride:
        typeof recipientOverride === "string" ? recipientOverride : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          message: safeMessage(result.code, result.reason),
        },
        { status: result.code === "not_configured" ? 503 : 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "[TransactionalEmail] Error:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { ok: false, message: "Failed to send order email. Please try again." },
      { status: 500 },
    );
  }
}
