import { getAdminDb } from "@/lib/server/firebase-admin";
import { createPendingOrderServer } from "@/lib/server/create-order";
import { clientKeyFromRequest, rateLimit } from "@/lib/server/rate-limit";
import { requestIdentity, requireOrderActor } from "@/lib/server/request-auth";
import { belongsToStore } from "@/lib/store";
import type { PlaceOrderInput } from "@/services/orders.service";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const limited = rateLimit({ key: clientKeyFromRequest(request, "orders-resolve"), limit: 30, windowMs: 60000 });
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const number = new URL(request.url).searchParams.get("order")?.trim();
  if (!number || number.length > 200 || number.includes("/")) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await requestIdentity(request);
    const db = getAdminDb();
    const matches = await db.collection("orders").where("orderNumber", "==", number.toUpperCase()).get();
    const ownStore = matches.docs.filter((doc) => belongsToStore(doc.data()));
    if (ownStore.length > 1) return NextResponse.json({ ok: false }, { status: 409 });
    const snapshot = ownStore[0] ?? await db.collection("orders").doc(number).get();
    if (!snapshot.exists || !belongsToStore(snapshot.data()!)) return NextResponse.json({ ok: false }, { status: 404 });
    await requireOrderActor(request, snapshot.data()!);
    return NextResponse.json({ ok: true, orderId: snapshot.id });
  } catch (error) {
    return NextResponse.json({ ok: false }, { status: error instanceof Error && error.message === "Authentication required." ? 401 : 403 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "orders-create"),
    limit: 20,
    windowMs: 60000,
  });
  if (!limited.ok)
    return NextResponse.json(
      { ok: false, reason: "Too many requests." },
      { status: 429 },
    );
  try {
    const identity = await requestIdentity(request);
    const profile = (
      await getAdminDb().collection("users").doc(identity.uid).get()
    ).data();
    if (profile?.active === false || profile?.status === "suspended" || profile?.status === "deleted")
      return NextResponse.json(
        { ok: false, reason: "Access denied." },
        { status: 403 },
      );
    const body = (await request.json()) as PlaceOrderInput;
    if (!body || !Array.isArray(body.lines) || body.lines.length > 100)
      return NextResponse.json(
        { ok: false, reason: "Invalid order." },
        { status: 400 },
      );
    const result = await createPendingOrderServer({
      ...body,
      userId: identity.uid,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        ok: false,
        reason:
          message === "Authentication required." ||
          message ===
            "Admin has not configured the store name. Please contact support."
            ? message
            : "Order creation failed. Check store configuration and authentication.",
      },
      { status: message === "Authentication required." ? 401 : 400 },
    );
  }
}
