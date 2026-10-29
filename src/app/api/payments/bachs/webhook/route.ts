import { verifyBachsWebhookSignature } from "@/lib/server/bachs";
import { verifyBachsForReference } from "@/lib/server/bachs-payment-service";
import { getBachsWebhookSecrets } from "@/lib/server/bachs-settings";
import { withStoreRequest } from "@/lib/server/store-request";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return withStoreRequest(
    request,
    async () => {
      const raw = await request.text();
      const valid = verifyBachsWebhookSignature(
        raw,
        {
          signature: request.headers.get("x-bachs-signature"),
          signatureV2: request.headers.get("x-bachs-signature-v2"),
          timestamp: request.headers.get("x-bachs-timestamp"),
        },
        await getBachsWebhookSecrets(),
      );
      if (!valid)
        return NextResponse.json(
          { ok: false, reason: "Invalid signature." },
          { status: 401 },
        );
      const event = JSON.parse(raw);
      if (
        ![
          "collection.succeeded",
          "collection.failed",
          "checkout.completed",
          "checkout.expired",
        ].includes(event.type)
      )
        return NextResponse.json({ ok: true, ignored: true });
      // Event status never authorizes fulfillment; query the saved account's checkout session.
      const result = await verifyBachsForReference(
        event.data.reference,
        `${event.type}:${event.id || event.data.reference}`,
      );
      return NextResponse.json(result, { status: result.ok ? 200 : 500 });
    },
    { webhook: "bachs" },
  );
}
