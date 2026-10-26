import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { getMonnifyConfiguration } from "@/lib/server/monnify-settings";
import { verifyMonnifyWebhookSignature } from "@/lib/server/monnify";
import { verifyMonnifyForReference } from "@/lib/server/monnify-payment-service";
import { clientKeyFromRequest, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "monnify-webhook"),
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const raw = await request.text();
  let event: { eventType?: string; eventData?: { paymentReference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Invalid JSON." },
      { status: 400 },
    );
  }
  const reference = event?.eventData?.paymentReference;
  if (
    event?.eventType !== "SUCCESSFUL_TRANSACTION" ||
    typeof reference !== "string" ||
    !/^MN[a-f0-9]{32}$/.test(reference)
  )
    return NextResponse.json({ ok: true, ignored: true });
  try {
    const snapshot = await getAdminDb()
      .collection("payments")
      .where("reference", "==", reference)
      .limit(1)
      .get();
    const payment = snapshot.docs[0]?.data();
    if (!payment || payment.gateway !== "monnify")
      return NextResponse.json({ ok: true, ignored: true });
    // Use the saved attempt environment, never the current checkout mode.
    if (typeof payment.metadata?.sandbox !== "boolean")
      return NextResponse.json({ ok: false }, { status: 401 });
    const config = await getMonnifyConfiguration(payment.metadata.sandbox);
    const signature = request.headers.get("monnify-signature");
    // Monnify omits signatures in sandbox. Only recorded sandbox attempts can use this exception.
    if (
      (signature !== null || !payment.metadata.sandbox) &&
      !verifyMonnifyWebhookSignature(raw, signature, config.secretKey)
    )
      return NextResponse.json(
        { ok: false, reason: "Invalid signature." },
        { status: 401 },
      );
    // Always query Monnify. Neither payload status nor amount authorizes fulfillment.
    const result = await verifyMonnifyForReference(
      reference,
      `SUCCESSFUL_TRANSACTION:${reference}`,
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Monnify webhook processing failed." },
      { status: 500 },
    );
  }
}
