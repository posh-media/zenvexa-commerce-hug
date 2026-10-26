import { NextResponse } from "next/server";
import { initializePaystackBodySchema } from "@/schemas/payment.schema";
import { initializePaystackForOrder } from "@/lib/server/payment-service";
import { reportPaymentFailure } from "@/lib/monitoring";
import {
  clientKeyFromRequest,
  publicErrorMessage,
  rateLimit,
} from "@/lib/server/rate-limit";
import {
  getPaystackFunctionsBaseUrl,
  isPaystackConfigured,
} from "@/lib/server/env";
import { isFirebaseAdminConfigured } from "@/lib/server/firebase-admin";
import { paymentLog } from "@/lib/server/payment-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InitOk = {
  ok: true;
  authorizationUrl: string;
  accessCode?: string;
  reference: string;
  orderId: string;
  orderNumber?: string | null;
  paymentId?: string;
};

type InitFail = { ok: false; reason: string };

async function initializeViaCloudFunction(input: {
  orderId: string;
  callbackUrl?: string;
}): Promise<InitOk | InitFail> {
  const url = `${getPaystackFunctionsBaseUrl()}/paystackInitialize`;
  paymentLog("init.functions", "Proxying initialize to Cloud Function", {
    url,
    orderId: input.orderId,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      orderId: input.orderId,
      callbackUrl: input.callbackUrl,
    }),
    cache: "no-store",
  });

  let body: InitOk | InitFail;
  try {
    body = (await response.json()) as InitOk | InitFail;
  } catch {
    return {
      ok: false,
      reason: "Payment initialize service returned an invalid response.",
    };
  }

  if (!response.ok || !body.ok) {
    return {
      ok: false,
      reason:
        ("reason" in body && body.reason) ||
        `Initialize failed (${response.status}).`,
    };
  }

  return body;
}

export async function POST(request: Request) {
  const limited = rateLimit({
    key: clientKeyFromRequest(request, "paystack-init"),
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, reason: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000) || 1),
        },
      },
    );
  }

  try {
    const json = await request.json();
    const parsed = initializePaystackBodySchema.safeParse(json);
    if (!parsed.success) {
      paymentLog("init.failure", "Invalid initialize body", {});
      return NextResponse.json(
        { ok: false, reason: "Invalid request body." },
        { status: 400 },
      );
    }

    paymentLog("init.request", "Initialize API called", {
      orderId: parsed.data.orderId,
      hasCallback: Boolean(parsed.data.callbackUrl),
      adminConfigured: isFirebaseAdminConfigured(),
      paystackConfigured: await isPaystackConfigured(),
    });

    let result: InitOk | InitFail;

    if (isFirebaseAdminConfigured() && (await isPaystackConfigured())) {
      paymentLog("init.admin", "Using Firebase Admin + Paystack secret", {
        orderId: parsed.data.orderId,
      });
      try {
        result = await initializePaystackForOrder({
          orderId: parsed.data.orderId,
          callbackUrl: parsed.data.callbackUrl,
        });
      } catch (error) {
        paymentLog("init.failure", "Admin initialize threw — falling back to CF", {
          orderId: parsed.data.orderId,
          message: error instanceof Error ? error.message : "unknown",
        });
        result = await initializeViaCloudFunction({
          orderId: parsed.data.orderId,
          callbackUrl: parsed.data.callbackUrl,
        });
      }
    } else {
      paymentLog(
        "init.functions",
        "Admin/secret incomplete — using Cloud Function initialize",
        {
          orderId: parsed.data.orderId,
          adminConfigured: isFirebaseAdminConfigured(),
          paystackConfigured: isPaystackConfigured(),
        },
      );
      result = await initializeViaCloudFunction({
        orderId: parsed.data.orderId,
        callbackUrl: parsed.data.callbackUrl,
      });
    }

    if (!result.ok) {
      paymentLog("init.failure", "Initialize rejected", {
        orderId: parsed.data.orderId,
        reason: result.reason,
      });
      reportPaymentFailure("Paystack initialize rejected", {
        orderId: parsed.data.orderId,
        reason: result.reason,
      });
      return NextResponse.json(result, { status: 400 });
    }

    paymentLog("init.redirect", "Initialize succeeded — ready to redirect", {
      orderId: result.orderId,
      reference: result.reference,
      hasAuthorizationUrl: Boolean(result.authorizationUrl),
      hasAccessCode: Boolean(result.accessCode),
    });

    return NextResponse.json({
      ok: true,
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode ?? null,
      reference: result.reference,
      orderId: result.orderId,
      orderNumber: result.orderNumber ?? null,
    });
  } catch (error) {
    paymentLog("init.failure", "Initialize unhandled error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    reportPaymentFailure("Paystack initialize failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        reason: publicErrorMessage(error, "Could not initialize payment."),
      },
      { status: 500 },
    );
  }
}
