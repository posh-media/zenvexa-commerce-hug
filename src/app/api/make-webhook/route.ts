import { getAdminDb } from "@/lib/server/firebase-admin";
import { notifyMakeOrderPaid } from "@/lib/server/make-webhook";
import { withStoreRequest } from "@/lib/server/store-request";
import type { Order } from "@/types/order";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePOST(request: Request) {
  try {
    const payload = await request.json();

    // Validate required fields
    if (!payload.orderId || !payload.customerEmail) {
      return NextResponse.json(
        { ok: false, reason: "Missing required order data" },
        { status: 400 },
      );
    }

    const snapshot = await getAdminDb()
      .collection("orders")
      .doc(payload.orderId)
      .get();
    if (!snapshot.exists)
      return NextResponse.json(
        { ok: false, reason: "Order not found." },
        { status: 404 },
      );
    const order = { id: snapshot.id, ...snapshot.data() } as Order;
    if (order.paymentStatus !== "paid")
      return NextResponse.json(
        {
          ok: false,
          reason: "Cannot send a paid-order notification for an unpaid order.",
        },
        { status: 400 },
      );

    const result = await notifyMakeOrderPaid({
      order,
      reference: payload.reference || payload.orderId,
      force: true, // Allow manual resend
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason || "Failed to send to Make.com" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Order email sent successfully",
    });
  } catch (error) {
    console.error("[MakeWebhook] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return withStoreRequest(request, () => handlePOST(request), {
    staffOnly: true,
  });
}
