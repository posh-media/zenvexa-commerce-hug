import { COLLECTIONS } from "@/constants/collections";
import { COD_FEE_PURPOSE } from "@/lib/cod";
import {
  getAppUrl,
  isKorapayConfigured,
  isKorapayEnabled,
  isPaystackConfigured,
  isPaystackEnabled,
  toKobo,
  trustedCallbackUrl,
} from "@/lib/server/env";
import {
  finalizeCodCommitmentFee,
  finalizeSuccessfulPayment,
  markPaymentFailed,
} from "@/lib/server/finalize-payment";
import { getAdminDb } from "@/lib/server/firebase-admin";
import {
  initializeKorapayTransaction,
  amountsMatch as korapayAmountsMatch,
  normalizeKorapayVerification,
  verifyKorapayTransaction,
} from "@/lib/server/korapay";
import { appendTimelineAdmin } from "@/lib/server/order-timeline";
import { paymentLog } from "@/lib/server/payment-log";
import {
  amountsMatch,
  initializePaystackTransaction,
  normalizePaystackVerification,
  verifyPaystackTransaction,
} from "@/lib/server/paystack";
import { currentStoreContext } from "@/lib/server/store-context";
import type { Order } from "@/types/order";
import { stripUndefined } from "@/utils/firestore";
import { FieldValue } from "firebase-admin/firestore";

// IMPORTANT: Paystack vs KoraPay amount handling
// Paystack: Requires amounts in kobo (Naira * 100) - uses toKobo()
// KoraPay: Requires amounts in Naira directly - does NOT use toKobo()

// Re-export toKobo for Paystack compatibility
export { toKobo } from "@/lib/server/env";

function paymentReferenceForOrder(order: Order) {
  const base = (order.orderNumber || order.id).replace(/[^a-zA-Z0-9]/g, "");
  return `SB_${base}_${Date.now()}`.slice(0, 100);
}

export async function initializePaystackForOrder(input: {
  orderId: string;
  callbackUrl?: string;
}) {
  if (!(await isPaystackEnabled())) {
    return {
      ok: false as const,
      reason: "Paystack is currently disabled.",
    };
  }
  if (!(await isPaystackConfigured())) {
    return {
      ok: false as const,
      reason: "Paystack is not configured on the server.",
    };
  }

  const db = getAdminDb();
  const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    return { ok: false as const, reason: "Order not found." };
  }

  const order = { id: orderSnap.id, ...orderSnap.data() } as Order;
  const method = String(order.paymentMethod ?? "");
  if (method !== "paystack" && method !== "card") {
    return {
      ok: false as const,
      reason: "This order is not set up for Paystack.",
    };
  }

  if (order.paymentStatus === "paid") {
    return { ok: false as const, reason: "This order is already paid." };
  }

  const email = order.customer?.email?.trim();
  if (!email) {
    return { ok: false as const, reason: "Order is missing a customer email." };
  }

  const amount = Number(order.total ?? order.totals?.total ?? 0);
  if (!(amount > 0)) {
    return { ok: false as const, reason: "Order total is invalid." };
  }

  const reference = paymentReferenceForOrder(order);
  const callbackUrl = trustedCallbackUrl(
    input.callbackUrl,
    `${getAppUrl()}/payments/callback?order=${encodeURIComponent(order.orderNumber ?? order.id)}`,
  );

  const initialized = await initializePaystackTransaction({
    email,
    amountNaira: amount,
    reference,
    callbackUrl,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
    },
  });

  paymentLog("init.paystack", "Paystack Initialize API OK", {
    orderId: order.id,
    reference: initialized.reference,
    hasAuthorizationUrl: Boolean(initialized.authorization_url),
  });

  const paymentRef = db.collection(COLLECTIONS.payments).doc();
  await paymentRef.set(
    stripUndefined({
      orderId: order.id,
      orderNumber: order.orderNumber ?? "",
      userId: order.userId,
      gateway: "paystack",
      storeId: currentStoreContext().id,
      storeName: order.storeName || currentStoreContext().storeName,
      credentialVersion: currentStoreContext().credentialVersion,
      reference: initialized.reference,
      amount,
      amountKobo: toKobo(amount),
      currency: "NGN",
      status: "processing",
      customerEmail: email,
      metadata: {
        accessCode: initialized.access_code,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );

  await orderRef.update(
    stripUndefined({
      paymentMethod: "paystack",
      paymentStatus: "processing",
      paymentReference: initialized.reference,
      paymentId: paymentRef.id,
      timeline: appendTimelineAdmin(order.timeline, "payment_processing"),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );

  return {
    ok: true as const,
    authorizationUrl: initialized.authorization_url,
    reference: initialized.reference,
    accessCode: initialized.access_code,
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentId: paymentRef.id,
  };
}

export async function initializeKorapayForOrder(input: {
  orderId: string;
  callbackUrl?: string;
}) {
  console.log("[initializeKorapayForOrder] Starting initialization", {
    orderId: input.orderId,
  });

  if (!(await isKorapayEnabled())) {
    console.log("[initializeKorapayForOrder] KoraPay is disabled");
    return {
      ok: false as const,
      reason: "KoraPay is currently disabled.",
    };
  }
  if (!(await isKorapayConfigured())) {
    console.log("[initializeKorapayForOrder] KoraPay is not configured");
    return {
      ok: false as const,
      reason: "KoraPay is not configured on the server.",
    };
  }

  console.log("[initializeKorapayForOrder] Getting Admin DB");
  const db = getAdminDb();
  const orderRef = db.collection(COLLECTIONS.orders).doc(input.orderId);
  console.log("[initializeKorapayForOrder] Fetching order", {
    orderId: input.orderId,
  });

  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    console.log("[initializeKorapayForOrder] Order not found");
    return { ok: false as const, reason: "Order not found." };
  }

  const order = { id: orderSnap.id, ...orderSnap.data() } as Order;
  console.log("[initializeKorapayForOrder] Order found", {
    orderId: order.id,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
  });

  const method = String(order.paymentMethod ?? "");
  if (method !== "korapay") {
    console.log("[initializeKorapayForOrder] Order not set up for KoraPay", {
      method,
    });
    return {
      ok: false as const,
      reason: "This order is not set up for KoraPay.",
    };
  }

  if (order.paymentStatus === "paid") {
    console.log("[initializeKorapayForOrder] Order already paid");
    return { ok: false as const, reason: "This order is already paid." };
  }

  const email = order.customer?.email?.trim();
  if (!email) {
    console.log("[initializeKorapayForOrder] Missing customer email");
    return { ok: false as const, reason: "Order is missing a customer email." };
  }

  const amount = Number(order.total ?? order.totals?.total ?? 0);
  if (!(amount > 0)) {
    console.log("[initializeKorapayForOrder] Invalid order total", { amount });
    return { ok: false as const, reason: "Order total is invalid." };
  }

  const reference = paymentReferenceForOrder(order);
  const redirectUrl = trustedCallbackUrl(
    input.callbackUrl,
    `${getAppUrl()}/payments/callback?order=${encodeURIComponent(order.orderNumber ?? order.id)}`,
  );

  console.log("[initializeKorapayForOrder] Calling KoraPay API", {
    email,
    amount,
    reference,
    redirectUrl,
  });

  let initialized;
  try {
    initialized = await initializeKorapayTransaction({
      email,
      amountNaira: amount,
      reference,
      redirectUrl,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        customerName: order.customer?.name,
      },
    });
  } catch (error) {
    console.error("[initializeKorapayForOrder] KoraPay API error", error);
    return {
      ok: false as const,
      reason:
        error instanceof Error
          ? error.message
          : "Failed to initialize KoraPay payment",
    };
  }

  console.log("[initializeKorapayForOrder] KoraPay API response", {
    hasCheckoutUrl: Boolean(initialized.checkout_url),
    reference: initialized.reference,
  });

  paymentLog("init.korapay", "KoraPay Initialize API OK", {
    orderId: order.id,
    reference: initialized.reference,
    hasCheckoutUrl: Boolean(initialized.checkout_url),
  });

  const paymentRef = db.collection(COLLECTIONS.payments).doc();
  console.log("[initializeKorapayForOrder] Creating payment document", {
    paymentId: paymentRef.id,
  });

  await paymentRef.set(
    stripUndefined({
      orderId: order.id,
      orderNumber: order.orderNumber ?? "",
      userId: order.userId,
      gateway: "korapay",
      storeId: currentStoreContext().id,
      storeName: order.storeName || currentStoreContext().storeName,
      credentialVersion: currentStoreContext().credentialVersion,
      reference: initialized.reference,
      amount,
      // KoraPay uses Naira directly, not kobo like Paystack
      currency: "NGN",
      status: "processing",
      customerEmail: email,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );

  console.log(
    "[initializeKorapayForOrder] Updating order with payment reference",
  );
  await orderRef.update(
    stripUndefined({
      paymentMethod: "korapay",
      paymentStatus: "processing",
      paymentReference: initialized.reference,
      paymentId: paymentRef.id,
      timeline: appendTimelineAdmin(order.timeline, "payment_processing"),
      updatedAt: FieldValue.serverTimestamp(),
    }),
  );

  console.log("[initializeKorapayForOrder] Initialization successful", {
    authorizationUrl: initialized.checkout_url,
    reference: initialized.reference,
  });

  return {
    ok: true as const,
    authorizationUrl: initialized.checkout_url,
    reference: initialized.reference,
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentId: paymentRef.id,
  };
}

export async function verifyPaystackForReference(reference: string) {
  if (!(await isPaystackEnabled())) {
    return {
      ok: false as const,
      reason: "Paystack is currently disabled.",
    };
  }
  if (!(await isPaystackConfigured())) {
    return {
      ok: false as const,
      reason: "Paystack is not configured on the server.",
    };
  }

  const db = getAdminDb();
  const paymentSnap = await db
    .collection(COLLECTIONS.payments)
    .where("reference", "==", reference)
    .limit(1)
    .get();

  let orderId: string | undefined;
  let paymentDocId: string | undefined;
  let expectedAmount: number | undefined;
  let isCodFee = false;

  if (!paymentSnap.empty) {
    const doc = paymentSnap.docs[0]!;
    paymentDocId = doc.id;
    const data = doc.data();
    orderId = data.orderId as string;
    expectedAmount = Number(data.amount);
    isCodFee = data.purpose === COD_FEE_PURPOSE;
  }

  const verified = await verifyPaystackTransaction(reference);
  const normalized = normalizePaystackVerification(verified);

  if (!orderId) {
    const meta = verified.metadata as
      { orderId?: string; purpose?: string } | undefined;
    orderId = meta?.orderId;
    if (meta?.purpose === COD_FEE_PURPOSE) isCodFee = true;
  }

  if (!orderId) {
    return {
      ok: false as const,
      reason: "Could not resolve the order for this payment reference.",
    };
  }

  if (normalized.status !== "paid") {
    await markPaymentFailed({
      orderId,
      reference,
      status:
        normalized.status === "cancelled"
          ? "cancelled"
          : normalized.status === "expired"
            ? "expired"
            : "failed",
      reason: verified.gateway_response || `Payment ${verified.status}`,
    });
    return {
      ok: false as const,
      reason: verified.gateway_response || `Payment ${verified.status}`,
      status: normalized.status,
      orderId,
      reference,
    };
  }

  if (
    expectedAmount != null &&
    !amountsMatch(expectedAmount, verified.amount)
  ) {
    return {
      ok: false as const,
      reason: "Paid amount does not match the recorded payment.",
      code: "amount_mismatch",
    };
  }

  const finalized = isCodFee
    ? await finalizeCodCommitmentFee({
        orderId,
        payment: normalized,
        paymentDocId,
      })
    : await finalizeSuccessfulPayment({
        orderId,
        payment: normalized,
        paymentDocId,
      });

  if (!finalized.ok) {
    return {
      ok: false as const,
      reason: finalized.reason,
      code: finalized.code,
      orderId,
      reference,
    };
  }

  // Best-effort Make.com notify (same path as webhook).
  const { notifyMakeOrderPaid } = await import("@/lib/server/make-webhook");
  await notifyMakeOrderPaid({
    order: finalized.order,
    reference,
  });

  return {
    ok: true as const,
    order: finalized.order,
    alreadyProcessed: finalized.alreadyProcessed,
    payment: normalized,
    reference,
  };
}

export async function verifyKorapayForReference(reference: string) {
  if (!(await isKorapayEnabled())) {
    return {
      ok: false as const,
      reason: "KoraPay is currently disabled.",
    };
  }
  if (!(await isKorapayConfigured())) {
    return {
      ok: false as const,
      reason: "KoraPay is not configured on the server.",
    };
  }

  console.log("[verifyKorapayForReference] Starting verification", {
    reference,
  });

  const db = getAdminDb();

  // First try to find payment by the exact reference
  const paymentSnap = await db
    .collection(COLLECTIONS.payments)
    .where("reference", "==", reference)
    .limit(1)
    .get();

  console.log("[verifyKorapayForReference] Initial payment lookup", {
    reference,
    found: !paymentSnap.empty,
    count: paymentSnap.size,
  });

  let orderId: string | undefined;
  let paymentDocId: string | undefined;
  let expectedAmount: number | undefined;
  let isCodFee = false;

  if (!paymentSnap.empty) {
    const doc = paymentSnap.docs[0]!;
    paymentDocId = doc.id;
    const data = doc.data();
    orderId = data.orderId as string;
    expectedAmount = Number(data.amount);
    isCodFee = data.purpose === COD_FEE_PURPOSE;
    console.log("[verifyKorapayForReference] Found payment by reference", {
      orderId,
      paymentDocId,
      storedReference: data.reference,
    });
  }

  // If not found by reference, try to find by orderId from metadata or by looking up the order
  if (!orderId) {
    console.log(
      "[verifyKorapayForReference] No payment found by reference, trying KoraPay verification",
    );

    // Try to verify with KoraPay first to get the actual transaction details
    let verified;
    try {
      verified = await verifyKorapayTransaction(reference);
      console.log("[verifyKorapayForReference] KoraPay verification response", {
        reference,
        status: verified.status,
        korapayReference: verified.reference,
        metadata: verified.metadata,
      });
    } catch (error) {
      console.error("[verifyKorapayForReference] KoraPay verification failed", {
        reference,
        error: error instanceof Error ? error.message : "unknown",
      });
      return {
        ok: false as const,
        reason: "Transaction not found or verification failed.",
      };
    }

    const normalized = normalizeKorapayVerification(verified);

    // Extract orderId from KoraPay metadata
    const meta = verified.metadata as
      { orderId?: string; orderNumber?: string; purpose?: string } | undefined;
    orderId = meta?.orderId;
    if (meta?.purpose === COD_FEE_PURPOSE) isCodFee = true;

    console.log(
      "[verifyKorapayForReference] Extracted orderId from KoraPay metadata",
      {
        orderId,
        orderNumber: meta?.orderNumber,
      },
    );

    if (!orderId) {
      return {
        ok: false as const,
        reason: "Could not resolve the order for this payment reference.",
      };
    }

    // Now look up the payment by orderId
    const orderSnap = await db
      .collection(COLLECTIONS.orders)
      .doc(orderId)
      .get();
    if (!orderSnap.exists) {
      console.log("[verifyKorapayForReference] Order not found", { orderId });
      return {
        ok: false as const,
        reason: "Order not found.",
      };
    }

    const order = { id: orderSnap.id, ...orderSnap.data() } as Order;
    if (!isCodFee && order.paymentMethod === "cash-on-delivery")
      isCodFee = true;
    expectedAmount = isCodFee
      ? Number(order.codCommitmentFee ?? 0)
      : Number(order.total ?? order.totals?.total ?? 0);

    // Look for payment by orderId
    const paymentsByOrder = await db
      .collection(COLLECTIONS.payments)
      .where("orderId", "==", orderId)
      .where("gateway", "==", "korapay")
      .limit(1)
      .get();

    if (!paymentsByOrder.empty) {
      const doc = paymentsByOrder.docs[0]!;
      paymentDocId = doc.id;
      console.log("[verifyKorapayForReference] Found payment by orderId", {
        paymentDocId,
        storedReference: doc.data().reference,
      });
    }

    if (normalized.status !== "paid") {
      await markPaymentFailed({
        orderId,
        reference,
        status:
          normalized.status === "cancelled"
            ? "cancelled"
            : normalized.status === "expired"
              ? "expired"
              : "failed",
        reason: `Payment ${verified.status}`,
      });
      return {
        ok: false as const,
        reason: `Payment ${verified.status}`,
        status: normalized.status,
        orderId,
        reference,
      };
    }

    if (
      expectedAmount != null &&
      !korapayAmountsMatch(expectedAmount, verified.amount)
    ) {
      console.error("[verifyKorapayForReference] Amount mismatch", {
        expectedAmount,
        paidAmount: verified.amount,
      });
      return {
        ok: false as const,
        reason: "Paid amount does not match the recorded payment.",
        code: "amount_mismatch",
      };
    }

    const finalized = isCodFee
      ? await finalizeCodCommitmentFee({
          orderId,
          payment: normalized,
          paymentDocId,
        })
      : await finalizeSuccessfulPayment({
          orderId,
          payment: normalized,
          paymentDocId,
        });

    if (!finalized.ok) {
      return {
        ok: false as const,
        reason: finalized.reason,
        code: finalized.code,
        orderId,
        reference,
      };
    }

    // Best-effort Make.com notify (same path as webhook).
    const { notifyMakeOrderPaid } = await import("@/lib/server/make-webhook");
    await notifyMakeOrderPaid({
      order: finalized.order,
      reference,
    });

    return {
      ok: true as const,
      order: finalized.order,
      alreadyProcessed: finalized.alreadyProcessed,
      payment: normalized,
      reference,
    };
  }

  // Payment found by reference, proceed with verification
  console.log("[verifyKorapayForReference] Proceeding with found payment", {
    orderId,
    paymentDocId,
    expectedAmount,
  });

  const verified = await verifyKorapayTransaction(reference);
  const normalized = normalizeKorapayVerification(verified);

  console.log("[verifyKorapayForReference] KoraPay verification result", {
    reference,
    status: verified.status,
    amount: verified.amount,
    normalizedStatus: normalized.status,
  });

  if (normalized.status !== "paid") {
    await markPaymentFailed({
      orderId,
      reference,
      status:
        normalized.status === "cancelled"
          ? "cancelled"
          : normalized.status === "expired"
            ? "expired"
            : "failed",
      reason: `Payment ${verified.status}`,
    });
    return {
      ok: false as const,
      reason: `Payment ${verified.status}`,
      status: normalized.status,
      orderId,
      reference,
    };
  }

  if (
    expectedAmount != null &&
    !korapayAmountsMatch(expectedAmount, verified.amount)
  ) {
    console.error("[verifyKorapayForReference] Amount mismatch", {
      expectedAmount,
      paidAmount: verified.amount,
    });
    return {
      ok: false as const,
      reason: "Paid amount does not match the recorded payment.",
      code: "amount_mismatch",
    };
  }

  const finalized = isCodFee
    ? await finalizeCodCommitmentFee({
        orderId,
        payment: normalized,
        paymentDocId,
      })
    : await finalizeSuccessfulPayment({
        orderId,
        payment: normalized,
        paymentDocId,
      });

  if (!finalized.ok) {
    return {
      ok: false as const,
      reason: finalized.reason,
      code: finalized.code,
      orderId,
      reference,
    };
  }

  // Best-effort Make.com notify (same path as webhook).
  const { notifyMakeOrderPaid } = await import("@/lib/server/make-webhook");
  await notifyMakeOrderPaid({
    order: finalized.order,
    reference,
  });

  return {
    ok: true as const,
    order: finalized.order,
    alreadyProcessed: finalized.alreadyProcessed,
    payment: normalized,
    reference,
  };
}
