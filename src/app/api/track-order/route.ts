import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { COLLECTIONS } from "@/constants/collections";
import { publicErrorMessage } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get("order");

  if (!orderNumber || !orderNumber.trim()) {
    return NextResponse.json(
      { ok: false, reason: "Order number is required." },
      { status: 400 },
    );
  }

  try {
    const db = getAdminDb();
    const normalized = orderNumber.trim().toUpperCase();

    // Try to find by orderNumber field first
    const snapshot = await db
      .collection(COLLECTIONS.orders)
      .where("orderNumber", "==", normalized)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const orderDoc = snapshot.docs[0];
      return NextResponse.json({
        ok: true,
        order: { id: orderDoc.id, ...orderDoc.data() },
      });
    }

    // If not found by orderNumber, try by document ID
    try {
      const docSnapshot = await db
        .collection(COLLECTIONS.orders)
        .doc(orderNumber.trim())
        .get();

      if (docSnapshot.exists) {
        return NextResponse.json({
          ok: true,
          order: { id: docSnapshot.id, ...docSnapshot.data() },
        });
      }
    } catch {
      // Document ID lookup failed, continue to not found
    }

    return NextResponse.json(
      { ok: false, reason: "No order found for that number." },
      { status: 404 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: publicErrorMessage(error, "Could not load order."),
      },
      { status: 500 },
    );
  }
}
