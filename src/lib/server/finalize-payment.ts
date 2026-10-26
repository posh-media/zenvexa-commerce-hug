import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from "firebase-admin/firestore";
import { stockStatusFromCount } from "@/constants/app";
import { COLLECTIONS } from "@/constants/collections";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { appendTimelineAdmin } from "@/lib/server/order-timeline";
import { computeCodCommitmentFee, COD_FEE_PURPOSE } from "@/lib/cod";
import { toKobo } from "@/lib/server/env";
import type { Order, OrderItem, PaymentStatus } from "@/types/order";
import type {
  NormalizedPaymentResult,
  PaymentDocument,
} from "@/types/payment";
import { stripUndefined } from "@/utils/firestore";

export type FinalizeResult =
  | { ok: true; order: Order; alreadyProcessed: boolean }
  | { ok: false; reason: string; code?: string };

function asOrder(id: string, data: DocumentData): Order {
  return { id, ...(data as Omit<Order, "id">) };
}

async function findPaymentRefByReference(reference: string) {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.payments)
    .where("reference", "==", reference)
    .limit(1)
    .get();
  return snapshot.empty ? null : snapshot.docs[0]!.ref;
}

/**
 * Atomically mark payment paid, decrement stock (once), update payment doc,
 * and append timeline. Idempotent if order is already paid.
 */
export async function finalizeSuccessfulPayment(input: {
  orderId: string;
  payment: NormalizedPaymentResult;
  paymentDocId?: string;
  eventId?: string;
}): Promise<FinalizeResult> {
  const db = getAdminDb();

  let paymentRef: DocumentReference | null = input.paymentDocId
    ? db.collection(COLLECTIONS.payments).doc(input.paymentDocId)
    : await findPaymentRefByReference(input.payment.reference);

  try {
    const result = await db.runTransaction(async (tx) => {
      const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        return {
          ok: false as const,
          reason: "Order not found.",
          code: "not_found",
        };
      }

      const order = asOrder(orderSnap.id, orderSnap.data()!);

      if (order.paymentStatus === "paid" && order.inventoryReserved) {
        return { ok: true as const, order, alreadyProcessed: true };
      }

      const expectedTotal = Number(order.total ?? order.totals?.total ?? 0);
      if (
        input.payment.status === "paid" &&
        Math.abs(toKobo(expectedTotal) - toKobo(input.payment.amount)) > 0
      ) {
        return {
          ok: false as const,
          reason: "Paid amount does not match the order total.",
          code: "amount_mismatch",
        };
      }

      if (
        input.payment.currency &&
        input.payment.currency.toUpperCase() !== "NGN"
      ) {
        return {
          ok: false as const,
          reason: "Unsupported payment currency.",
          code: "currency_mismatch",
        };
      }

      const lines = (order.products ?? order.items ?? []) as OrderItem[];
      if (!lines.length) {
        return {
          ok: false as const,
          reason: "Order has no line items.",
          code: "empty_order",
        };
      }

      type ProductLock = {
        ref: DocumentReference;
        stock: number;
        salesCount: number;
        qty: number;
      };
      const productLocks: ProductLock[] = [];

      if (!order.inventoryReserved) {
        for (const line of lines) {
          const productRef = db
            .collection(COLLECTIONS.products)
            .doc(line.productId);
          const productSnap = await tx.get(productRef);
          if (!productSnap.exists) {
            return {
              ok: false as const,
              reason: `"${line.name ?? line.productId}" is no longer available.`,
              code: "product_missing",
            };
          }
          const product = productSnap.data()!;
          if (product.active === false) {
            return {
              ok: false as const,
              reason: `"${line.name ?? line.productId}" is unavailable.`,
              code: "product_inactive",
            };
          }
          const stock = Number(product.stock ?? 0);
          const qty = Number(line.quantity ?? 0);
          if (stock < qty) {
            return {
              ok: false as const,
              reason:
                stock <= 0
                  ? `"${line.name ?? line.productId}" is out of stock.`
                  : `Only ${stock} of "${line.name ?? line.productId}" left in stock.`,
              code: "insufficient_stock",
            };
          }
          productLocks.push({
            ref: productRef,
            stock,
            salesCount: Number(product.salesCount ?? 0),
            qty,
          });
        }
      }

      if (!paymentRef) {
        paymentRef = db.collection(COLLECTIONS.payments).doc();
      }

      const paymentSnap = await tx.get(paymentRef);
      const existingPayment = paymentSnap.exists ? paymentSnap.data() : null;
      const processedEventIds: string[] = Array.isArray(
        existingPayment?.processedEventIds,
      )
        ? [...(existingPayment!.processedEventIds as string[])]
        : [];

      if (input.eventId && processedEventIds.includes(input.eventId)) {
        return { ok: true as const, order, alreadyProcessed: true };
      }
      if (input.eventId) processedEventIds.push(input.eventId);

      if (!order.inventoryReserved) {
        for (const item of productLocks) {
          const nextStock = item.stock - item.qty;
          tx.update(item.ref, {
            stock: nextStock,
            stockStatus: stockStatusFromCount(nextStock),
            salesCount: item.salesCount + item.qty,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      const timeline = appendTimelineAdmin(
        order.timeline,
        "payment_successful",
      );
      const confirmed = appendTimelineAdmin(timeline, "order_confirmed");

      tx.update(orderRef, stripUndefined({
        paymentStatus: "paid",
        orderStatus: "paid",
        status: "paid",
        paymentReference: input.payment.reference,
        paymentId: paymentRef.id,
        inventoryReserved: true,
        paidAt: input.payment.paidAt
          ? new Date(input.payment.paidAt)
          : FieldValue.serverTimestamp(),
        timeline: confirmed,
        updatedAt: FieldValue.serverTimestamp(),
      }));

      const paymentPayload: Record<string, unknown> = {
        orderId: order.id,
        orderNumber: order.orderNumber ?? "",
        userId: order.userId,
        gateway: input.payment.gateway,
        reference: input.payment.reference,
        amount: input.payment.amount,
        amountKobo: toKobo(input.payment.amount),
        currency: input.payment.currency || "NGN",
        status: "paid",
        customerEmail: input.payment.customerEmail ?? "",
        channel: input.payment.channel ?? "",
        gatewayResponse: input.payment.gatewayResponse ?? {},
        verificationData: input.payment.gatewayResponse ?? {},
        authorization: input.payment.authorization ?? {},
        paidAt: input.payment.paidAt
          ? new Date(input.payment.paidAt)
          : new Date(),
        verifiedAt: FieldValue.serverTimestamp(),
        processedEventIds,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (!paymentSnap.exists) {
        paymentPayload.createdAt = FieldValue.serverTimestamp();
      }

      tx.set(paymentRef, stripUndefined(paymentPayload), { merge: true });

      return {
        ok: true as const,
        order: {
          ...order,
          paymentStatus: "paid" as const,
          orderStatus: "paid" as const,
          status: "paid" as const,
          paymentReference: input.payment.reference,
          paymentId: paymentRef.id,
          inventoryReserved: true,
          timeline: confirmed,
        },
        alreadyProcessed: false,
      };
    });

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not finalize payment.";
    return { ok: false, reason: message, code: "finalize_error" };
  }
}

/** Mark payment failed/cancelled/expired without touching inventory. */
export async function markPaymentFailed(input: {
  orderId: string;
  reference?: string;
  status: "failed" | "cancelled" | "expired";
  reason?: string;
  eventId?: string;
}): Promise<FinalizeResult> {
  const db = getAdminDb();
  const paymentRef = input.reference
    ? await findPaymentRefByReference(input.reference)
    : null;

  try {
    const result = await db.runTransaction(async (tx) => {
      const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        return {
          ok: false as const,
          reason: "Order not found.",
          code: "not_found",
        };
      }
      const order = asOrder(orderSnap.id, orderSnap.data()!);

      if (order.paymentStatus === "paid") {
        return { ok: true as const, order, alreadyProcessed: true };
      }

      const paymentSnap = paymentRef ? await tx.get(paymentRef) : null;

      const event =
        input.status === "cancelled"
          ? "payment_cancelled"
          : input.status === "expired"
            ? "payment_expired"
            : "payment_failed";

      const timeline = appendTimelineAdmin(
        order.timeline,
        event,
        input.reason,
      );

      if (paymentSnap?.exists) {
        const paymentData = paymentSnap.data()!;
        const processedEventIds: string[] = Array.isArray(
          paymentData.processedEventIds,
        )
          ? [...(paymentData.processedEventIds as string[])]
          : [];
        if (input.eventId && processedEventIds.includes(input.eventId)) {
          return { ok: true as const, order, alreadyProcessed: true };
        }
        if (input.eventId) processedEventIds.push(input.eventId);
        tx.update(paymentRef!, stripUndefined({
          status: input.status,
          processedEventIds,
          updatedAt: FieldValue.serverTimestamp(),
        }));
      }

      tx.update(orderRef, stripUndefined({
        paymentStatus: input.status,
        ...(String(order.paymentMethod ?? "") === "cash-on-delivery"
          ? { commitmentFeeStatus: input.status }
          : {}),
        ...(input.reference ? { paymentReference: input.reference } : {}),
        timeline,
        updatedAt: FieldValue.serverTimestamp(),
      }));

      return {
        ok: true as const,
        order: {
          ...order,
          paymentStatus: input.status,
          ...(String(order.paymentMethod ?? "") === "cash-on-delivery"
            ? { commitmentFeeStatus: input.status as PaymentStatus }
            : {}),
          timeline,
        },
        alreadyProcessed: false,
      };
    });
    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not update payment status.";
    return { ok: false, reason: message };
  }
}

/** Confirm COD: reserve inventory, keep payment pending, confirm order. */
export async function finalizeCashOnDelivery(
  orderId: string,
): Promise<FinalizeResult> {
  const db = getAdminDb();
  try {
    const result = await db.runTransaction(async (tx) => {
      const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        return {
          ok: false as const,
          reason: "Order not found.",
          code: "not_found",
        };
      }
      const order = asOrder(orderSnap.id, orderSnap.data()!);

      if (order.inventoryReserved) {
        return { ok: true as const, order, alreadyProcessed: true };
      }

      const method = String(order.paymentMethod ?? "");
      if (method !== "cash-on-delivery") {
        return {
          ok: false as const,
          reason: "Order is not a cash-on-delivery order.",
          code: "invalid_method",
        };
      }

      // Orders created with a commitment fee must have it verified first.
      if (
        order.codCommitmentFee !== undefined &&
        order.commitmentFeeStatus !== "paid"
      ) {
        return {
          ok: false as const,
          reason:
            "A 25% commitment fee must be paid before this order can be confirmed.",
          code: "commitment_fee_required",
        };
      }

      const lines = (order.products ?? order.items ?? []) as OrderItem[];
      for (const line of lines) {
        const productRef = db
          .collection(COLLECTIONS.products)
          .doc(line.productId);
        const productSnap = await tx.get(productRef);
        if (!productSnap.exists) {
          return {
            ok: false as const,
            reason: `"${line.name ?? line.productId}" is no longer available.`,
            code: "product_missing",
          };
        }
        const product = productSnap.data()!;
        const stock = Number(product.stock ?? 0);
        const qty = Number(line.quantity ?? 0);
        if (stock < qty) {
          return {
            ok: false as const,
            reason: `Insufficient stock for "${line.name ?? line.productId}".`,
            code: "insufficient_stock",
          };
        }
        const nextStock = stock - qty;
        tx.update(productRef, {
          stock: nextStock,
          stockStatus: stockStatusFromCount(nextStock),
          salesCount: Number(product.salesCount ?? 0) + qty,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      const timeline = appendTimelineAdmin(
        appendTimelineAdmin(order.timeline, "payment_pending"),
        "order_confirmed",
        "Cash on delivery — pay when your order arrives.",
      );

      const paymentRef = db.collection(COLLECTIONS.payments).doc();
      const reference = `COD-${order.orderNumber ?? order.id}`;
      const paymentPayload: PaymentDocument = {
        orderId: order.id,
        orderNumber: order.orderNumber ?? "",
        userId: order.userId,
        gateway: "cod",
        reference,
        amount: Number(order.total ?? 0),
        currency: "NGN",
        status: "pending",
        customerEmail: order.customer?.email ?? "",
        createdAt: FieldValue.serverTimestamp() as never,
        updatedAt: FieldValue.serverTimestamp() as never,
      };
      tx.set(paymentRef, stripUndefined(paymentPayload));

      tx.update(orderRef, stripUndefined({
        paymentStatus: "pending",
        orderStatus: "processing",
        status: "processing",
        inventoryReserved: true,
        paymentId: paymentRef.id,
        paymentReference: reference,
        timeline,
        updatedAt: FieldValue.serverTimestamp(),
      }));

      return {
        ok: true as const,
        order: {
          ...order,
          paymentStatus: "pending" as const,
          orderStatus: "processing" as const,
          status: "processing" as const,
          inventoryReserved: true,
          paymentId: paymentRef.id,
          paymentReference: reference,
          timeline,
        },
        alreadyProcessed: false,
      };
    });
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not confirm COD order.";
    return { ok: false, reason: message };
  }
}

/**
 * Finalize a verified COD commitment-fee payment (25% of the order total).
 * Marks the fee paid, reserves inventory, confirms the order, and records the
 * remaining balance due on delivery. The order is NOT marked fully paid.
 */
export async function finalizeCodCommitmentFee(input: {
  orderId: string;
  payment: NormalizedPaymentResult;
  paymentDocId?: string;
  eventId?: string;
}): Promise<FinalizeResult> {
  const db = getAdminDb();

  let paymentRef: DocumentReference | null = input.paymentDocId
    ? db.collection(COLLECTIONS.payments).doc(input.paymentDocId)
    : await findPaymentRefByReference(input.payment.reference);

  try {
    const result = await db.runTransaction(async (tx) => {
      const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists) {
        return {
          ok: false as const,
          reason: "Order not found.",
          code: "not_found",
        };
      }

      const order = asOrder(orderSnap.id, orderSnap.data()!);

      if (order.commitmentFeeStatus === "paid" && order.inventoryReserved) {
        return { ok: true as const, order, alreadyProcessed: true };
      }

      const method = String(order.paymentMethod ?? "");
      if (method !== "cash-on-delivery") {
        return {
          ok: false as const,
          reason: "Order is not a cash-on-delivery order.",
          code: "invalid_method",
        };
      }

      const expectedFee = Number(
        order.codCommitmentFee ??
          computeCodCommitmentFee(Number(order.total ?? order.totals?.total ?? 0)),
      );
      if (
        input.payment.status === "paid" &&
        Math.abs(toKobo(expectedFee) - toKobo(input.payment.amount)) > 0
      ) {
        return {
          ok: false as const,
          reason: "Paid amount does not match the required commitment fee.",
          code: "amount_mismatch",
        };
      }

      if (
        input.payment.currency &&
        input.payment.currency.toUpperCase() !== "NGN"
      ) {
        return {
          ok: false as const,
          reason: "Unsupported payment currency.",
          code: "currency_mismatch",
        };
      }

      const lines = (order.products ?? order.items ?? []) as OrderItem[];
      if (!lines.length) {
        return {
          ok: false as const,
          reason: "Order has no line items.",
          code: "empty_order",
        };
      }

      type ProductLock = {
        ref: DocumentReference;
        stock: number;
        salesCount: number;
        qty: number;
      };
      const productLocks: ProductLock[] = [];

      if (!order.inventoryReserved) {
        for (const line of lines) {
          const productRef = db
            .collection(COLLECTIONS.products)
            .doc(line.productId);
          const productSnap = await tx.get(productRef);
          if (!productSnap.exists) {
            return {
              ok: false as const,
              reason: `"${line.name ?? line.productId}" is no longer available.`,
              code: "product_missing",
            };
          }
          const product = productSnap.data()!;
          if (product.active === false) {
            return {
              ok: false as const,
              reason: `"${line.name ?? line.productId}" is unavailable.`,
              code: "product_inactive",
            };
          }
          const stock = Number(product.stock ?? 0);
          const qty = Number(line.quantity ?? 0);
          if (stock < qty) {
            return {
              ok: false as const,
              reason:
                stock <= 0
                  ? `"${line.name ?? line.productId}" is out of stock.`
                  : `Only ${stock} of "${line.name ?? line.productId}" left in stock.`,
              code: "insufficient_stock",
            };
          }
          productLocks.push({
            ref: productRef,
            stock,
            salesCount: Number(product.salesCount ?? 0),
            qty,
          });
        }
      }

      if (!paymentRef) {
        paymentRef = db.collection(COLLECTIONS.payments).doc();
      }

      const paymentSnap = await tx.get(paymentRef);
      const existingPayment = paymentSnap.exists ? paymentSnap.data() : null;
      const processedEventIds: string[] = Array.isArray(
        existingPayment?.processedEventIds,
      )
        ? [...(existingPayment!.processedEventIds as string[])]
        : [];

      if (input.eventId && processedEventIds.includes(input.eventId)) {
        return { ok: true as const, order, alreadyProcessed: true };
      }
      if (input.eventId) processedEventIds.push(input.eventId);

      if (!order.inventoryReserved) {
        for (const item of productLocks) {
          const nextStock = item.stock - item.qty;
          tx.update(item.ref, {
            stock: nextStock,
            stockStatus: stockStatusFromCount(nextStock),
            salesCount: item.salesCount + item.qty,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      const total = Number(order.total ?? order.totals?.total ?? 0);
      const amountPaid = input.payment.amount;
      const balance = Math.max(0, total - amountPaid);

      const timeline = appendTimelineAdmin(
        order.timeline,
        "payment_successful",
        "25% commitment fee received.",
      );
      const confirmed = appendTimelineAdmin(
        timeline,
        "order_confirmed",
        "Commitment fee verified — balance due on delivery.",
      );

      tx.update(
        orderRef,
        stripUndefined({
          commitmentFeeStatus: "paid",
          codAmountPaid: amountPaid,
          codBalance: balance,
          commitmentFeePaidAt: input.payment.paidAt
            ? new Date(input.payment.paidAt)
            : FieldValue.serverTimestamp(),
          paymentStatus: "pending",
          orderStatus: "processing",
          status: "processing",
          paymentGateway: input.payment.gateway,
          paymentReference: input.payment.reference,
          paymentId: paymentRef.id,
          inventoryReserved: true,
          timeline: confirmed,
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );

      const paymentPayload: Record<string, unknown> = {
        orderId: order.id,
        orderNumber: order.orderNumber ?? "",
        userId: order.userId,
        gateway: input.payment.gateway,
        purpose: COD_FEE_PURPOSE,
        reference: input.payment.reference,
        amount: input.payment.amount,
        amountKobo: toKobo(input.payment.amount),
        currency: input.payment.currency || "NGN",
        status: "paid",
        customerEmail: input.payment.customerEmail ?? "",
        channel: input.payment.channel ?? "",
        gatewayResponse: input.payment.gatewayResponse ?? {},
        verificationData: input.payment.gatewayResponse ?? {},
        authorization: input.payment.authorization ?? {},
        paidAt: input.payment.paidAt
          ? new Date(input.payment.paidAt)
          : new Date(),
        verifiedAt: FieldValue.serverTimestamp(),
        processedEventIds,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (!paymentSnap.exists) {
        paymentPayload.createdAt = FieldValue.serverTimestamp();
      }

      tx.set(paymentRef, stripUndefined(paymentPayload), { merge: true });

      return {
        ok: true as const,
        order: {
          ...order,
          commitmentFeeStatus: "paid" as const,
          codAmountPaid: amountPaid,
          codBalance: balance,
          paymentStatus: "pending" as const,
          orderStatus: "processing" as const,
          status: "processing" as const,
          paymentGateway: input.payment.gateway,
          paymentReference: input.payment.reference,
          paymentId: paymentRef.id,
          inventoryReserved: true,
          timeline: confirmed,
        },
        alreadyProcessed: false,
      };
    });

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not finalize payment.";
    return { ok: false, reason: message, code: "finalize_error" };
  }
}
