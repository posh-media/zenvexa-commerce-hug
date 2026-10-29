import { COLLECTIONS } from "@/constants/collections";
import { COD_FEE_PURPOSE, computeCodCommitmentFee } from "@/lib/cod";
import { reportPaymentFailure } from "@/lib/monitoring";
import {
  getPaystackFunctionsBaseUrl,
  isPaystackConfigured,
  isPaystackEnabled,
} from "@/lib/server/env";
import {
  finalizeCodCommitmentFee,
  finalizeSuccessfulPayment,
  markPaymentFailed,
} from "@/lib/server/finalize-payment";
import {
  getAdminDb,
  isFirebaseAdminConfigured,
} from "@/lib/server/firebase-admin";
import { notifyMakeOrderPaid } from "@/lib/server/make-webhook";
import { paymentLog } from "@/lib/server/payment-log";
import {
  amountsMatch,
  mapPaystackStatus,
  normalizePaystackVerification,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
  type PaystackVerifyData,
} from "@/lib/server/paystack";
import { publicErrorMessage } from "@/lib/server/rate-limit";
import { currentStoreId } from "@/lib/server/store-context";
import { withStoreRequest } from "@/lib/server/store-request";
import type { Order } from "@/types/order";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaystackEvent = {
  event?: string;
  data?: PaystackVerifyData & {
    id?: number;
    metadata?: { orderId?: string; orderNumber?: string; purpose?: string };
  };
};

const SUPPORTED = new Set([
  "charge.success",
  "charge.failed",
  "transfer.success",
  "refund.processed",
]);

async function proxyWebhookToCloudFunction(
  rawBody: string,
  signature: string | null,
) {
  if (currentStoreId() !== "shopbeta")
    return NextResponse.json(
      { ok: false, reason: "Store payment configuration unavailable." },
      { status: 503 },
    );
  const url = `${getPaystackFunctionsBaseUrl()}/paystackWebhook`;
  paymentLog("webhook.functions", "Proxying webhook to Cloud Function", {
    url,
    bytes: rawBody.length,
    hasSignature: Boolean(signature),
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(signature ? { "x-paystack-signature": signature } : {}),
    },
    body: rawBody,
    cache: "no-store",
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = {
      ok: false,
      reason: "Cloud Function returned an invalid response.",
    };
  }

  paymentLog("webhook.functions", "Cloud Function webhook response", {
    status: response.status,
    ok:
      typeof body === "object" && body !== null && "ok" in body
        ? body.ok
        : null,
  });

  return NextResponse.json(body, { status: response.status });
}

/**
 * Paystack webhook — production ready:
 * signature → verify with Paystack API → atomic Firestore → Make.com (best-effort).
 */
async function handlePOST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  paymentLog("webhook.incoming", "Paystack webhook received", {
    bytes: rawBody.length,
    hasSignature: Boolean(signature),
    adminConfigured: isFirebaseAdminConfigured(),
    paystackConfigured: isPaystackConfigured(),
    paystackEnabled: isPaystackEnabled(),
  });

  if (!isFirebaseAdminConfigured() || !(await isPaystackConfigured())) {
    return proxyWebhookToCloudFunction(rawBody, signature);
  }

  if (!(await verifyPaystackWebhookSignature(rawBody, signature))) {
    paymentLog("webhook.signature", "Invalid Paystack signature", {});
    reportPaymentFailure("Paystack webhook invalid signature");
    return NextResponse.json(
      { ok: false, reason: "Invalid signature." },
      { status: 401 },
    );
  }

  paymentLog("webhook.signature", "Signature valid", {});

  let payload: PaystackEvent;
  try {
    payload = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    paymentLog("webhook.failure", "Invalid JSON body", {});
    return NextResponse.json(
      { ok: false, reason: "Invalid JSON." },
      { status: 400 },
    );
  }

  const event = payload.event ?? "";
  const data = payload.data;

  paymentLog("webhook.event", "Parsed Paystack event", {
    event,
    reference: data?.reference,
    paystackId: data?.id,
  });

  if (!data?.reference) {
    paymentLog("webhook.ignored", "Missing payment reference", { event });
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!SUPPORTED.has(event)) {
    paymentLog("webhook.ignored", "Unsupported event type", { event });
    return NextResponse.json({ ok: true, ignored: true, event });
  }

  const eventId = `${event}:${data.id ?? data.reference}`;

  try {
    const db = getAdminDb();
    const paymentSnap = await db
      .collection(COLLECTIONS.payments)
      .where("reference", "==", data.reference)
      .limit(1)
      .get();

    const paymentDoc = paymentSnap.empty ? null : paymentSnap.docs[0]!;
    const paymentData = paymentDoc?.data();
    const paymentDocId = paymentDoc?.id;
    const orderId =
      (paymentData?.orderId as string | undefined) || data.metadata?.orderId;

    if (!orderId) {
      paymentLog("webhook.ignored", "Order not found for reference", {
        reference: data.reference,
        event,
      });
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "order_not_found",
      });
    }

    // ---------- charge.success ----------
    if (event === "charge.success") {
      // Never trust webhook payload alone — verify with Paystack.
      let verified: PaystackVerifyData;
      try {
        verified = await verifyPaystackTransaction(data.reference);
      } catch (error) {
        paymentLog("webhook.verify", "Paystack verify API failed", {
          reference: data.reference,
          message: error instanceof Error ? error.message : "unknown",
        });
        reportPaymentFailure("Paystack verify API failed on webhook", {
          reference: data.reference,
        });
        return NextResponse.json(
          { ok: false, reason: "Verification failed." },
          { status: 502 },
        );
      }

      const normalized = normalizePaystackVerification(verified);

      paymentLog("webhook.verify", "Paystack verification result", {
        reference: verified.reference,
        status: verified.status,
        amountKobo: verified.amount,
        currency: verified.currency,
        customerEmail: verified.customer?.email,
        mappedStatus: normalized.status,
      });

      if (normalized.status !== "paid") {
        paymentLog("webhook.ignored", "Verify status is not success", {
          status: verified.status,
        });
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "not_successful",
        });
      }

      const orderSnap = await db
        .collection(COLLECTIONS.orders)
        .doc(orderId)
        .get();
      if (!orderSnap.exists) {
        paymentLog("webhook.failure", "Order document missing", { orderId });
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "order_missing",
        });
      }
      const order = { id: orderSnap.id, ...orderSnap.data() } as Order;
      const isCodFee =
        paymentData?.purpose === COD_FEE_PURPOSE ||
        data.metadata?.purpose === COD_FEE_PURPOSE;
      const orderTotal = Number(order.total ?? order.totals?.total ?? 0);
      const expectedTotal = isCodFee
        ? Number(order.codCommitmentFee ?? computeCodCommitmentFee(orderTotal))
        : orderTotal;

      if (!amountsMatch(expectedTotal, verified.amount)) {
        paymentLog("webhook.failure", "Amount mismatch after verify", {
          orderId,
          expectedTotal,
          paidKobo: verified.amount,
        });
        reportPaymentFailure("Webhook amount mismatch", {
          orderId,
          reference: verified.reference,
        });
        return NextResponse.json({
          ok: false,
          reason: "Amount mismatch.",
        });
      }

      if ((verified.currency || "NGN").toUpperCase() !== "NGN") {
        paymentLog("webhook.failure", "Currency mismatch", {
          currency: verified.currency,
        });
        return NextResponse.json({
          ok: false,
          reason: "Currency mismatch.",
        });
      }

      const orderEmail = order.customer?.email?.trim().toLowerCase();
      const paidEmail = verified.customer?.email?.trim().toLowerCase();
      if (orderEmail && paidEmail && orderEmail !== paidEmail) {
        paymentLog("webhook.failure", "Customer email mismatch", {
          orderEmail,
          paidEmail,
        });
        reportPaymentFailure("Webhook email mismatch", { orderId });
        return NextResponse.json({
          ok: false,
          reason: "Customer email mismatch.",
        });
      }

      paymentLog("webhook.firestore", "Finalizing successful payment", {
        orderId,
        eventId,
        reference: verified.reference,
      });

      const result = isCodFee
        ? await finalizeCodCommitmentFee({
            orderId,
            payment: normalized,
            paymentDocId,
            eventId,
          })
        : await finalizeSuccessfulPayment({
            orderId,
            payment: normalized,
            paymentDocId,
            eventId,
          });

      if (!result.ok) {
        paymentLog("webhook.firestore", "Firestore finalize failed", {
          orderId,
          reason: result.reason,
          code: result.code,
        });
        reportPaymentFailure("Webhook Firestore finalize failed", {
          orderId,
          reason: result.reason,
        });
        return NextResponse.json(
          { ok: false, reason: result.reason },
          { status: 500 },
        );
      }

      paymentLog("webhook.firestore", "Firestore updated", {
        orderId,
        alreadyProcessed: result.alreadyProcessed,
      });

      // Make.com — after successful Firestore only; never fail Paystack ACK.
      await notifyMakeOrderPaid({
        order: result.order,
        reference: verified.reference,
      });

      paymentLog("webhook.success", "charge.success handled", {
        orderId,
        reference: verified.reference,
        alreadyProcessed: result.alreadyProcessed,
      });

      return NextResponse.json({
        ok: true,
        alreadyProcessed: result.alreadyProcessed,
        orderId,
        reference: verified.reference,
      });
    }

    // ---------- charge.failed ----------
    if (event === "charge.failed") {
      const status = mapPaystackStatus(data.status || "failed");
      paymentLog("webhook.firestore", "Marking payment failed", {
        orderId,
        eventId,
      });
      const result = await markPaymentFailed({
        orderId,
        reference: data.reference,
        status: status === "cancelled" ? "cancelled" : "failed",
        reason: data.gateway_response,
        eventId,
      });
      paymentLog("webhook.success", "charge.failed handled", {
        orderId,
        alreadyProcessed: result.ok ? result.alreadyProcessed : false,
      });
      return NextResponse.json({
        ok: result.ok,
        alreadyProcessed: result.ok ? result.alreadyProcessed : false,
      });
    }

    // ---------- refund.processed (prepared) ----------
    if (event === "refund.processed") {
      paymentLog("webhook.firestore", "Processing refund.processed", {
        orderId,
        eventId,
      });

      const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
      await db.runTransaction(async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists) return;
        const paymentRef = paymentDocId
          ? db.collection(COLLECTIONS.payments).doc(paymentDocId)
          : null;
        if (paymentRef) {
          const paymentSnap = await tx.get(paymentRef);
          if (paymentSnap.exists) {
            const processed: string[] = Array.isArray(
              paymentSnap.data()?.processedEventIds,
            )
              ? [...(paymentSnap.data()!.processedEventIds as string[])]
              : [];
            if (processed.includes(eventId)) return;
            processed.push(eventId);
            tx.update(paymentRef, {
              status: "refunded",
              gatewayResponse: data,
              processedEventIds: processed,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        }
        tx.update(orderRef, {
          paymentStatus: "refunded",
          orderStatus: "refunded",
          status: "refunded",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      paymentLog("webhook.success", "refund.processed acknowledged", {
        orderId,
      });
      return NextResponse.json({ ok: true, event });
    }

    // ---------- transfer.success (prepared) ----------
    paymentLog("webhook.success", "transfer.success acknowledged (prepared)", {
      reference: data.reference,
    });
    return NextResponse.json({ ok: true, event, acknowledged: true });
  } catch (error) {
    paymentLog("webhook.failure", "Unhandled webhook error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    reportPaymentFailure("Paystack webhook processing failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        ok: false,
        reason: publicErrorMessage(error, "Webhook processing failed."),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return withStoreRequest(request, () => handlePOST(request), {
    webhook: "paystack",
  });
}
