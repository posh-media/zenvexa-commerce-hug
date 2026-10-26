import { NextResponse } from "next/server";
import { notifyMakeOrderPaid } from "@/lib/server/make-webhook";
import type { Order } from "@/types/order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    // Validate required fields
    if (!payload.orderId || !payload.customerEmail) {
      return NextResponse.json(
        { ok: false, reason: "Missing required order data" },
        { status: 400 }
      );
    }
    
    // Create a mock order object for the Make.com notification
    const order = {
      id: payload.orderId,
      orderNumber: payload.orderId,
      customer: {
        name: payload.customerName,
        email: payload.customerEmail,
        phone: payload.phoneNumber,
      },
      createdAt: new Date(payload.orderDate || Date.now()),
      expectedDelivery: payload.expectedDelivery,
      shippingAddress: payload.shippingAddress,
      products: payload.products,
      subtotal: payload.subtotal,
      deliveryFee: payload.deliveryFee,
      discount: payload.discount,
      total: payload.totalPrice,
      paymentStatus: payload.paymentStatus,
      paymentMethod: payload.paymentMethod,
      paymentReference: payload.reference,
      orderStatus: payload.orderStatus,
      status: payload.orderStatus,
      items: payload.products,
      totals: {
        subtotal: payload.subtotal,
        deliveryFee: payload.deliveryFee,
        discount: payload.discount,
        total: payload.totalPrice,
      },
    } as unknown as Order;
    
    const result = await notifyMakeOrderPaid({
      order,
      reference: payload.reference || payload.orderId,
      force: true, // Allow manual resend
    });
    
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason || "Failed to send to Make.com" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ ok: true, message: "Order email sent successfully" });
  } catch (error) {
    console.error("[MakeWebhook] Error:", error);
    return NextResponse.json(
      { ok: false, reason: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
