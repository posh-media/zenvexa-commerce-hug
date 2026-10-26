import { NextResponse } from "next/server";
import { getSquadConfiguration } from "@/lib/server/squad-settings";
import { verifySquadWebhookSignature } from "@/lib/server/squad";
import { verifySquadForReference } from "@/lib/server/squad-payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-squad-encrypted-body");
  try {
    // Accept test and live events independently of the currently selected checkout mode.
    const configs = await Promise.all([
      getSquadConfiguration(true),
      getSquadConfiguration(false),
    ]);
    if (
      !configs.some((config) =>
        verifySquadWebhookSignature(raw, signature, config.secretKey),
      )
    ) {
      return NextResponse.json(
        { ok: false, reason: "Invalid signature." },
        { status: 401 },
      );
    }
    let event: {
      Event?: string;
      TransactionRef?: string;
      Body?: { transaction_ref?: string };
    };
    try {
      event = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { ok: false, reason: "Invalid JSON." },
        { status: 400 },
      );
    }
    if (!event || event.Event !== "charge_successful")
      return NextResponse.json({ ok: true, ignored: true });
    const reference = event.TransactionRef || event.Body?.transaction_ref;
    if (!reference || !/^SQ[a-f0-9]{32}$/.test(reference))
      return NextResponse.json({ ok: true, ignored: true });
    if (event.Body?.transaction_ref && event.Body.transaction_ref !== reference)
      return NextResponse.json(
        { ok: false, reason: "Reference mismatch." },
        { status: 400 },
      );
    const result = await verifySquadForReference(
      reference,
      `charge_successful:${reference}`,
    );
    // Acknowledge only completed processing so Squad can retry transient failures.
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "Squad webhook processing failed." },
      { status: 500 },
    );
  }
}
