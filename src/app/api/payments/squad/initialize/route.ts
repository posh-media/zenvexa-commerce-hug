import { isFirebaseAdminConfigured } from "@/lib/server/firebase-admin";
import { clientKeyFromRequest, rateLimit } from "@/lib/server/rate-limit";
import { initializeSquadForOrder } from "@/lib/server/squad-payment-service";
import { withStoreRequest } from "@/lib/server/store-request";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePOST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "squad-init"),
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
      { ok: false, reason: "Squad is not configured on the server." },
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
    const result = await initializeSquadForOrder(parsed.data.orderId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        reason: "Could not initialize Squad payment. Please try again shortly.",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  return withStoreRequest(request, () => handlePOST(request), {
    initialize: true,
  });
}
