import { NextResponse } from "next/server";
import {
  mapKorapayStatus,
  normalizeKorapayVerification,
  verifyKorapayTransaction,
  verifyKorapayWebhookSignature,
  amountsMatch,
  type KorapayVerifyData,
} from "@/lib/server/korapay";
import {
  finalizeCodCommitmentFee,
  finalizeSuccessfulPayment,
  markPaymentFailed,
} from "@/lib/server/finalize-payment";
import { computeCodCommitmentFee, COD_FEE_PURPOSE } from "@/lib/cod";
import { notifyMakeOrderPaid } from "@/lib/server/make-webhook";
import { paymentLog } from "@/lib/server/payment-log";
import { COLLECTIONS } from "@/constants/collections";
import { isKorapayConfigured, isKorapayEnabled } from "@/lib/server/env";
import {
  getAdminDb,
  isFirebaseAdminConfigured,
} from "@/lib/server/firebase-admin";
import { reportPaymentFailure } from "@/lib/monitoring";
import { publicErrorMessage } from "@/lib/server/rate-limit";
import { FieldValue } from "firebase-admin/firestore";
import type { Order } from "@/types/order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KorapayEvent = {
  event?: string;
  data?: KorapayVerifyData & {
    id?: string;
    metadata?: { orderId?: string; orderNumber?: string; purpose?: string };
  };
};

const SUPPORTED = new Set([
  "charge.success",
  "charge.failed",
  "transfer.success",
  "refund.processed",
]);

/**
 * KoraPay webhook — production ready:
 * signature → verify with KoraPay API → atomic Firestore → Make.com (best-effort).
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-korapay-signature");

  paymentLog("webhook.incoming", "KoraPay webhook received", {
    bytes: rawBody.length,
    hasSignature: Boolean(signature),
    adminConfigured: isFirebaseAdminConfigured(),
    korapayConfigured: isKorapayConfigured(),
    korapayEnabled: isKorapayEnabled(),
  });

  if (!isFirebaseAdminConfigured() || !isKorapayConfigured() || !isKorapayEnabled()) {
    paymentLog("webhook.failure", "KoraPay not configured", {});
    return NextResponse.json(
      { ok: false, reason: "KoraPay is not configured." },
      { status: 503 },
    );
  }

  let payload: KorapayEvent;
  try {
    payload = JSON.parse(rawBody) as KorapayEvent;
  } catch {
    paymentLog("webhook.failure", "Invalid JSON body", {});
    return NextResponse.json(
      { ok: false, reason: "Invalid JSON." },
      { status: 400 },
    );
  }

  if (!verifyKorapayWebhookSignature(payload, signature)) {
    paymentLog("webhook.signature", "Invalid KoraPay signature", {});
    reportPaymentFailure("KoraPay webhook invalid signature");
    return NextResponse.json(
      { ok: false, reason: "Invalid signature." },
      { status: 401 },
    );
  }

  paymentLog("webhook.signature", "Signature valid", {});

  const event = payload.event ?? "";
  const data = payload.data;

  paymentLog("webhook.event", "Parsed KoraPay event", {
    event,
    reference: data?.reference,
    korapayId: data?.id,
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
      (paymentData?.orderId as string | undefined) ||
      data.metadata?.orderId;

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
      // Never trust webhook payload alone — verify with KoraPay.
      let verified: KorapayVerifyData;
      try {
        verified = await verifyKorapayTransaction(data.reference);
      } catch (error) {
        paymentLog("webhook.verify", "KoraPay verify API failed", {
          reference: data.reference,
          message: error instanceof Error ? error.message : "unknown",
        });
        reportPaymentFailure("KoraPay verify API failed on webhook", {
          reference: data.reference,
        });
        return NextResponse.json(
          { ok: false, reason: "Verification failed." },
          { status: 502 },
        );
      }

      const normalized = normalizeKorapayVerification(verified);

      paymentLog("webhook.verify", "KoraPay verification result", {
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

      const orderSnap = await db.collection(COLLECTIONS.orders).doc(orderId).get();
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

      // Make.com — after successful Firestore only; never fail KoraPay ACK.
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
      const status = mapKorapayStatus(data.status || "failed");
      paymentLog("webhook.firestore", "Marking payment failed", {
        orderId,
        eventId,
      });
      const result = await markPaymentFailed({
        orderId,
        reference: data.reference,
        status: status === "cancelled" ? "cancelled" : "failed",
        reason: `Payment ${data.status}`,
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
    reportPaymentFailure("KoraPay webhook processing failed", {
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
