import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBachsForReference } from "@/lib/server/bachs-payment-service";
import { clientKeyFromRequest, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "bachs-verify"),
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok)
    return NextResponse.json(
      { ok: false, reason: "Too many requests. Try again shortly." },
      { status: 429 },
    );
  const parsed = z
    .object({ reference: z.string().regex(/^BA[a-f0-9]{32}$/) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, reason: "Invalid Bachs payment reference." },
      { status: 400 },
    );
  try {
    const result = await verifyBachsForReference(parsed.data.reference);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "Could not verify Bachs payment. Please try again shortly.",
      },
      { status: 502 },
    );
  }
}
