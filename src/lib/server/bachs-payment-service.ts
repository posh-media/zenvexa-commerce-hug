import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { getAppUrl } from "@/lib/server/env";
import { getBachsConfiguration } from "@/lib/server/bachs-settings";
import {
  createBachsCheckoutSession,
  getBachsCheckoutSession,
  normalizeBachsCheckout,
} from "@/lib/server/bachs";
import { appendTimelineAdmin } from "@/lib/server/order-timeline";
import {
  finalizeCodCommitmentFee,
  finalizeSuccessfulPayment,
} from "@/lib/server/finalize-payment";
import { COD_FEE_PURPOSE } from "@/lib/cod";
import { notifyMakeOrderPaid } from "@/lib/server/make-webhook";
import { stripUndefined } from "@/utils/firestore";
import type { Order } from "@/types/order";

export async function initializeBachsForOrder(orderId: string) {
  const config = await getBachsConfiguration();
  if (!config.enabled || !config.apiKey)
    return {
      ok: false as const,
      reason: "Bachs is not configured or is currently disabled.",
    };
  const db = getAdminDb();
  const orderRef = db.collection("orders").doc(orderId);
  const paymentRef = db.collection("payments").doc();
  const reference = `BA${randomUUID().replaceAll("-", "")}`;

  // Record the attempt before contacting Bachs so an early webhook can resolve it.
  const order = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(orderRef);
    if (!snapshot.exists) throw new Error("Order not found.");
    const order = { ...snapshot.data(), id: snapshot.id } as Order;
    if (order.paymentMethod !== "bachs")
      throw new Error("This order is not set up for Bachs.");
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
        gateway: "bachs",
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

  const appUrl = getAppUrl();
  const success = new URL("/payments/callback", appUrl);
  success.searchParams.set("order", order.orderNumber || order.id);
  success.searchParams.set("provider", "bachs");
  success.searchParams.set("reference", reference);
  const cancel = new URL("/payments/cancelled", appUrl);
  cancel.searchParams.set("order", order.orderNumber || order.id);
  cancel.searchParams.set("reference", reference);

  try {
    const amount = Number(order.total ?? order.totals?.total);
    const session = await createBachsCheckoutSession(config, {
      email: order.customer!.email!,
      customerName: order.customer?.name,
      phone: order.customer?.phone,
      amount: amount.toFixed(2),
      currency: "NGN",
      reference,
      successUrl: success.toString(),
      cancelUrl: cancel.toString(),
      metadata: stripUndefined({
        orderId,
        orderNumber: order.orderNumber,
      }),
      idempotencyKey: `checkout-${orderId}`,
    });
    await paymentRef.update({
      checkoutId: session.checkoutId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      ok: true as const,
      authorizationUrl: session.checkoutUrl,
      reference,
      checkoutId: session.checkoutId,
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

export async function verifyBachsForReference(
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
  if (!paymentDoc || paymentDoc.data().gateway !== "bachs")
    return { ok: false as const, reason: "Bachs payment not found." };
  const payment = paymentDoc.data();
  const isCodFee = payment.purpose === COD_FEE_PURPOSE;
  const orderSnap = await db.collection("orders").doc(payment.orderId).get();
  if (!orderSnap.exists)
    return { ok: false as const, reason: "Order not found." };
  const order = { ...orderSnap.data(), id: orderSnap.id } as Order;
  if (order.paymentMethod !== "bachs" && !isCodFee)
    return {
      ok: false as const,
      reason: "This order is not set up for Bachs.",
    };
  if (!payment.checkoutId)
    return {
      ok: false as const,
      reason: "Payment is still processing.",
      status: "processing",
    };

  // Visibility only blocks new payments. Hidden providers still settle existing attempts.
  const config = await getBachsConfiguration(payment.metadata?.sandbox);
  const session = await getBachsCheckoutSession(config, payment.checkoutId);
  if (session.reference && session.reference !== reference)
    return { ok: false as const, reason: "Payment reference does not match." };
  const normalized = normalizeBachsCheckout(session, reference);
  const expectedAmount = isCodFee
    ? Number(payment.amount)
    : Number(order.total ?? order.totals?.total);
  normalized.amount = expectedAmount;
  normalized.customerEmail = order.customer?.email;

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
