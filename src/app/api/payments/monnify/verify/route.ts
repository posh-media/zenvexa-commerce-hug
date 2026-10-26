import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyMonnifyForReference } from "@/lib/server/monnify-payment-service";
import { clientKeyFromRequest, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "monnify-verify"),
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok)
    return NextResponse.json(
      { ok: false, reason: "Too many requests. Try again shortly." },
      { status: 429 },
    );
  const parsed = z
    .object({ reference: z.string().regex(/^MN[a-f0-9]{32}$/) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, reason: "Invalid Monnify payment reference." },
      { status: 400 },
    );
  try {
    const result = await verifyMonnifyForReference(parsed.data.reference);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "Could not verify Monnify payment. Please try again shortly.",
      },
      { status: 502 },
    );
  }
}
