import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySquadForReference } from "@/lib/server/squad-payment-service";
import { clientKeyFromRequest, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "squad-verify"),
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok)
    return NextResponse.json(
      { ok: false, reason: "Too many requests. Try again shortly." },
      { status: 429 },
    );
  const parsed = z
    .object({ reference: z.string().regex(/^SQ[a-f0-9]{32}$/) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, reason: "Invalid Squad payment reference." },
      { status: 400 },
    );
  try {
    const result = await verifySquadForReference(parsed.data.reference);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "Could not verify Squad payment. Please try again shortly.",
      },
      { status: 502 },
    );
  }
}
