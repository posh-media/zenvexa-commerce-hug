import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { getAppUrl } from "@/lib/server/env";
import { getMonnifyConfiguration } from "@/lib/server/monnify-settings";
import {
  initializeMonnifyTransaction,
  normalizeMonnifyVerification,
  validateMonnifyPayment,
  verifyMonnifyTransaction,
} from "@/lib/server/monnify";
import { appendTimelineAdmin } from "@/lib/server/order-timeline";
import {
  finalizeCodCommitmentFee,
  finalizeSuccessfulPayment,
} from "@/lib/server/finalize-payment";
import { COD_FEE_PURPOSE } from "@/lib/cod";
import { notifyMakeOrderPaid } from "@/lib/server/make-webhook";
import { stripUndefined } from "@/utils/firestore";
import type { Order } from "@/types/order";

export async function initializeMonnifyForOrder(orderId: string) {
  const config = await getMonnifyConfiguration();
  if (
    !config.enabled ||
    !config.secretKey ||
    !config.apiKey ||
    !config.contractCode
  )
    return {
      ok: false as const,
      reason: "Monnify is not configured or is currently disabled.",
    };
  const db = getAdminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const paymentRef = db.collection("payments").doc();
  const reference = `MN${randomUUID().replaceAll("-", "")}`;

  // Record the attempt before contacting Monnify so an early webhook can resolve it.
  const order = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(orderRef);
    if (!snapshot.exists) throw new Error("Order not found.");
    const order = { ...snapshot.data(), id: snapshot.id } as Order;
    if (order.paymentMethod !== "monnify")
      throw new Error("This order is not set up for Monnify.");
    if (order.paymentStatus === "paid")
      throw new Error("This order is already paid.");
    const amount = Number(order.total ?? order.totals?.total ?? 0);
    if (
      !Number.isFinite(amount) ||
      amount < 1 ||
      !order.customer?.email?.trim()
    )
      throw new Error("Order total or customer email is invalid.");
    tx.set(
      paymentRef,
      stripUndefined({
        orderId,
        orderNumber: order.orderNumber,
        userId: order.userId,
        gateway: "monnify",
        reference,
        amount,
        amountKobo: Math.round(amount * 100),
        currency: "NGN",
        status: "processing",
        customerEmail: order.customer.email.trim(),
        metadata: { sandbox: config.sandbox },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
    tx.update(orderRef, {
      paymentStatus: "processing",
      paymentReference: reference,
      paymentId: paymentRef.id,
      timeline: appendTimelineAdmin(order.timeline, "payment_processing"),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return order;
  });

  const callback = new URL("/payments/callback", getAppUrl());
  callback.searchParams.set("order", order.orderNumber || order.id);
  callback.searchParams.set("provider", "monnify");
  callback.searchParams.set("reference", reference);
  try {
    const initialized = await initializeMonnifyTransaction(config, {
      email: order.customer!.email!,
      customerName: order.customer?.name,
      amount: Number(order.total ?? order.totals?.total),
      reference,
      callbackUrl: callback.toString(),
      metadata: stripUndefined({ orderId, orderNumber: order.orderNumber }),
    });
    await paymentRef.update({
      transactionReference: initialized.transactionReference,
    });
    return {
      ok: true as const,
      ...initialized,
      orderId,
      orderNumber: order.orderNumber,
    };
  } catch (error) {
    // Keep the attempt available for later reconciliation if the API timed out.
    await paymentRef.update({
      initializationFailed: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw error;
  }
}

export async function verifyMonnifyForReference(
  reference: string,
  eventId?: string,
) {
  const db = getAdminDb();
  const snapshot = await db
    .collection("payments")
    .where("reference", "==", reference)
    .limit(1)
    .get();
  const paymentDoc = snapshot.docs[0];
  if (!paymentDoc || paymentDoc.data().gateway !== "monnify")
    return { ok: false as const, reason: "Monnify payment not found." };
  const payment = paymentDoc.data();
  const isCodFee = payment.purpose === COD_FEE_PURPOSE;
  const orderSnap = await db.collection("orders").doc(payment.orderId).get();
  if (!orderSnap.exists)
    return { ok: false as const, reason: "Order not found." };
  const order = { ...orderSnap.data(), id: orderSnap.id } as Order;
  if (order.paymentMethod !== "monnify" && !isCodFee)
    return {
      ok: false as const,
      reason: "This order is not set up for Monnify.",
    };

  // Visibility only blocks new payments. Hidden providers still settle existing attempts.
  const config = await getMonnifyConfiguration(payment.metadata?.sandbox);
  const verified = await verifyMonnifyTransaction(config, reference);
  const normalized = normalizeMonnifyVerification(verified);
  if (verified.paymentReference !== reference)
    return { ok: false as const, reason: "Payment reference does not match." };
  if (normalized.status !== "paid") {
    if (normalized.status === "failed" || normalized.status === "cancelled") {
      await db.runTransaction(async (tx) => {
        const [latestOrder, latestPayment] = await Promise.all([
          tx.get(orderSnap.ref),
          tx.get(paymentDoc.ref),
        ]);
        if (latestPayment.data()?.status !== "paid") {
          tx.update(paymentDoc.ref, {
            status: normalized.status,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        // Recheck within the transaction: a retry or success may have arrived during verification.
        const latest = latestOrder.data();
        if (
          latest &&
          latest.paymentStatus !== "paid" &&
          latest.paymentReference === reference
        ) {
          tx.update(orderSnap.ref, {
            paymentStatus: normalized.status,
            timeline: appendTimelineAdmin(
              latest.timeline,
              normalized.status === "cancelled"
                ? "payment_cancelled"
                : "payment_failed",
            ),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
    }
    return {
      ok: false as const,
      reason:
        normalized.status === "processing"
          ? "Payment is still processing."
          : "Payment was not successful.",
      status: normalized.status,
    };
  }
  const invalid = validateMonnifyPayment(verified, {
    reference,
    amount: isCodFee
      ? Number(payment.amount)
      : Number(order.total ?? order.totals?.total),
    email: order.customer?.email,
    transactionReference: payment.transactionReference,
  });
  if (
    invalid ||
    Math.round(Number(payment.amount) * 100) !==
      Math.round(Number(verified.amountPaid) * 100)
  )
    return {
      ok: false as const,
      reason: invalid || "Paid amount does not match the recorded payment.",
    };
  const finalized = isCodFee
    ? await finalizeCodCommitmentFee({
        orderId: order.id,
        payment: normalized,
        paymentDocId: paymentDoc.id,
        eventId,
      })
    : await finalizeSuccessfulPayment({
        orderId: order.id,
        payment: normalized,
        paymentDocId: paymentDoc.id,
        eventId,
      });
  if (!finalized.ok) return finalized;
  await notifyMakeOrderPaid({ order: finalized.order, reference }).catch(
    () => undefined,
  );
  return {
    ok: true as const,
    reference,
    alreadyProcessed: finalized.alreadyProcessed,
    order: {
      id: finalized.order.id,
      orderNumber: finalized.order.orderNumber,
      paymentStatus: finalized.order.paymentStatus,
      orderStatus: finalized.order.orderStatus,
      total: finalized.order.total,
    },
    payment: {
      reference,
      status: normalized.status,
      amount: normalized.amount,
      currency: normalized.currency,
    },
  };
}
