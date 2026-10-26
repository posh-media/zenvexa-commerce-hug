import { NextResponse } from "next/server";
import { z } from "zod";
import { initializeMonnifyForOrder } from "@/lib/server/monnify-payment-service";
import { clientKeyFromRequest, rateLimit } from "@/lib/server/rate-limit";
import { isFirebaseAdminConfigured } from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "monnify-init"),
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok)
    return NextResponse.json(
      { ok: false, reason: "Too many requests. Try again shortly." },
      { status: 429 },
    );
  if (!isFirebaseAdminConfigured())
    return NextResponse.json(
      { ok: false, reason: "Monnify is not configured on the server." },
      { status: 503 },
    );
  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      orderId: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[^/]+$/),
    })
    .safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, reason: "Invalid request body." },
      { status: 400 },
    );
  try {
    const result = await initializeMonnifyForOrder(parsed.data.orderId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "Could not initialize Monnify payment. Please try again shortly.",
      },
      { status: 502 },
    );
  }
}
