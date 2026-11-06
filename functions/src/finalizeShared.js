const { storeFrom } = require("./store-routing");
/**
 * Shared order/payment finalization for gateway webhook Cloud Functions.
 * Mirrors the logic in paystackWebhook.js, parameterized by gateway name so
 * Squad/Bachs (and future providers) reuse the same safe, idempotent flow:
 * atomic Firestore transaction → stock decrement once → payment doc → timeline.
 */
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { stripUndefined } = require("./stripUndefined");

const COLLECTIONS = {
  orders: "orders",
  payments: "payments",
  products: "products",
};

const COD_FEE_PURPOSE = "cod_commitment_fee";

function computeCodCommitmentFee(orderTotal) {
  const total = Number(orderTotal);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.ceil(total * 0.25);
}

function log(stage, message, meta = {}) {
  console.log(
    JSON.stringify({
      payment: {
        at: new Date().toISOString(),
        stage,
        message,
        ...meta,
      },
    }),
  );
}

function toKobo(naira) {
  return Math.round(Number(naira) * 100);
}

function fromKobo(kobo) {
  return Number(kobo) / 100;
}

function amountsMatch(expectedNaira, paidKobo) {
  return Math.abs(toKobo(expectedNaira) - Number(paidKobo)) === 0;
}

function stockStatusFromCount(stock) {
  if (stock <= 0) return "out_of_stock";
  if (stock <= 5) return "low_stock";
  return "in_stock";
}

function appendTimeline(timeline, event, description) {
  const labels = {
    payment_successful: "Payment successful",
    order_confirmed: "Order confirmed",
    payment_failed: "Payment failed",
    payment_cancelled: "Payment cancelled",
  };
  const entry = {
    event,
    label: labels[event] || event,
    description: description || null,
    at: new Date(),
  };
  return Array.isArray(timeline) ? [...timeline, entry] : [entry];
}

async function finalizeSuccessfulPayment({
  gateway,
  orderId,
  verified,
  paymentDocId,
  eventId,
}) {
  const db = getFirestore();
  const amountNaira = fromKobo(verified.amount);

  return db.runTransaction(async (tx) => {
    const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (orderSnap.exists && storeFrom(orderSnap.data()) !== "shopbeta")
      throw new Error("Legacy handler store mismatch.");
    if (!orderSnap.exists) {
      return { ok: false, reason: "Order not found." };
    }
    const order = { id: orderSnap.id, ...orderSnap.data() };
    if (storeFrom(order) !== "shopbeta")
      throw new Error("Legacy handler store mismatch.");

    if (order.paymentStatus === "paid" && order.inventoryReserved) {
      return { ok: true, order, alreadyProcessed: true };
    }

    const expectedTotal = Number(order.total ?? order.totals?.total ?? 0);
    if (!amountsMatch(expectedTotal, verified.amount)) {
      return {
        ok: false,
        reason: "Paid amount does not match the order total.",
      };
    }
    if ((verified.currency || "NGN").toUpperCase() !== "NGN") {
      return { ok: false, reason: "Unsupported payment currency." };
    }

    const lines = order.products || order.items || [];
    if (!lines.length) {
      return { ok: false, reason: "Order has no line items." };
    }

    const productLocks = [];
    if (!order.inventoryReserved) {
      for (const line of lines) {
        const productRef = db
          .collection(COLLECTIONS.products)
          .doc(line.productId);
        const productSnap = await tx.get(productRef);
        if (!productSnap.exists) {
          return {
            ok: false,
            reason: `"${line.name || line.productId}" is no longer available.`,
          };
        }
        const product = productSnap.data();
        if (product.active === false) {
          return {
            ok: false,
            reason: `"${line.name || line.productId}" is unavailable.`,
          };
        }
        const stock = Number(product.stock ?? 0);
        const qty = Number(line.quantity ?? 0);
        if (stock < qty) {
          return {
            ok: false,
            reason: `Insufficient stock for "${line.name || line.productId}".`,
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

    const paymentRef = paymentDocId
      ? db.collection(COLLECTIONS.payments).doc(paymentDocId)
      : db.collection(COLLECTIONS.payments).doc();
    const paymentSnap = await tx.get(paymentRef);
    const existingPayment = paymentSnap.exists ? paymentSnap.data() : null;
    const processedEventIds = Array.isArray(existingPayment?.processedEventIds)
      ? [...existingPayment.processedEventIds]
      : [];

    if (eventId && processedEventIds.includes(eventId)) {
      return { ok: true, order, alreadyProcessed: true };
    }
    if (eventId) processedEventIds.push(eventId);

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

    const timeline = appendTimeline(
      appendTimeline(order.timeline, "payment_successful"),
      "order_confirmed",
    );

    tx.update(
      orderRef,
      stripUndefined({
        paymentStatus: "paid",
        orderStatus: "paid",
        status: "paid",
        paymentReference: verified.reference,
        paymentId: paymentRef.id,
        inventoryReserved: true,
        paidAt: verified.paid_at
          ? new Date(verified.paid_at)
          : FieldValue.serverTimestamp(),
        timeline,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );

    const paymentPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber || null,
      userId: order.userId,
      gateway,
      reference: verified.reference,
      amount: amountNaira,
      amountKobo: verified.amount,
      currency: verified.currency || "NGN",
      status: "paid",
      customerEmail: verified.customer?.email || null,
      channel: verified.channel || null,
      gatewayResponse: verified.gatewayResponse || verified,
      verificationData: verified,
      authorization: verified.authorization || null,
      paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date(),
      verifiedAt: FieldValue.serverTimestamp(),
      processedEventIds,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!paymentSnap.exists) {
      paymentPayload.createdAt = FieldValue.serverTimestamp();
    }
    tx.set(paymentRef, stripUndefined(paymentPayload), { merge: true });

    return {
      ok: true,
      alreadyProcessed: false,
      order: {
        ...order,
        paymentStatus: "paid",
        orderStatus: "paid",
        status: "paid",
        paymentReference: verified.reference,
        paymentId: paymentRef.id,
        inventoryReserved: true,
        timeline,
      },
    };
  });
}

async function finalizeCodCommitmentFee({
  gateway,
  orderId,
  verified,
  paymentDocId,
  eventId,
}) {
  const db = getFirestore();
  const amountNaira = fromKobo(verified.amount);

  return db.runTransaction(async (tx) => {
    const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (orderSnap.exists && storeFrom(orderSnap.data()) !== "shopbeta")
      throw new Error("Legacy handler store mismatch.");
    if (!orderSnap.exists) {
      return { ok: false, reason: "Order not found." };
    }
    const order = { id: orderSnap.id, ...orderSnap.data() };
    if (storeFrom(order) !== "shopbeta")
      throw new Error("Legacy handler store mismatch.");

    if (order.commitmentFeeStatus === "paid" && order.inventoryReserved) {
      return { ok: true, order, alreadyProcessed: true };
    }

    if (String(order.paymentMethod || "") !== "cash-on-delivery") {
      return { ok: false, reason: "Order is not a cash-on-delivery order." };
    }

    const expectedFee = Number(
      order.codCommitmentFee ??
        computeCodCommitmentFee(
          Number(order.total ?? order.totals?.total ?? 0),
        ),
    );
    if (!amountsMatch(expectedFee, verified.amount)) {
      return {
        ok: false,
        reason: "Paid amount does not match the required commitment fee.",
      };
    }
    if ((verified.currency || "NGN").toUpperCase() !== "NGN") {
      return { ok: false, reason: "Unsupported payment currency." };
    }

    const lines = order.products || order.items || [];
    if (!lines.length) {
      return { ok: false, reason: "Order has no line items." };
    }

    const productLocks = [];
    if (!order.inventoryReserved) {
      for (const line of lines) {
        const productRef = db
          .collection(COLLECTIONS.products)
          .doc(line.productId);
        const productSnap = await tx.get(productRef);
        if (!productSnap.exists) {
          return {
            ok: false,
            reason: `"${line.name || line.productId}" is no longer available.`,
          };
        }
        const product = productSnap.data();
        if (product.active === false) {
          return {
            ok: false,
            reason: `"${line.name || line.productId}" is unavailable.`,
          };
        }
        const stock = Number(product.stock ?? 0);
        const qty = Number(line.quantity ?? 0);
        if (stock < qty) {
          return {
            ok: false,
            reason: `Insufficient stock for "${line.name || line.productId}".`,
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

    const paymentRef = paymentDocId
      ? db.collection(COLLECTIONS.payments).doc(paymentDocId)
      : db.collection(COLLECTIONS.payments).doc();
    const paymentSnap = await tx.get(paymentRef);
    const existingPayment = paymentSnap.exists ? paymentSnap.data() : null;
    const processedEventIds = Array.isArray(existingPayment?.processedEventIds)
      ? [...existingPayment.processedEventIds]
      : [];

    if (eventId && processedEventIds.includes(eventId)) {
      return { ok: true, order, alreadyProcessed: true };
    }
    if (eventId) processedEventIds.push(eventId);

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
    const balance = Math.max(0, total - amountNaira);

    const timeline = appendTimeline(
      appendTimeline(
        order.timeline,
        "payment_successful",
        "25% commitment fee received.",
      ),
      "order_confirmed",
      "Commitment fee verified — balance due on delivery.",
    );

    tx.update(
      orderRef,
      stripUndefined({
        commitmentFeeStatus: "paid",
        codAmountPaid: amountNaira,
        codBalance: balance,
        commitmentFeePaidAt: verified.paid_at
          ? new Date(verified.paid_at)
          : FieldValue.serverTimestamp(),
        paymentStatus: "pending",
        orderStatus: "processing",
        status: "processing",
        paymentGateway: gateway,
        paymentReference: verified.reference,
        paymentId: paymentRef.id,
        inventoryReserved: true,
        timeline,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );

    const paymentPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber || null,
      userId: order.userId,
      gateway,
      purpose: COD_FEE_PURPOSE,
      reference: verified.reference,
      amount: amountNaira,
      amountKobo: verified.amount,
      currency: verified.currency || "NGN",
      status: "paid",
      customerEmail: verified.customer?.email || null,
      channel: verified.channel || null,
      gatewayResponse: verified.gatewayResponse || verified,
      verificationData: verified,
      authorization: verified.authorization || null,
      paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date(),
      verifiedAt: FieldValue.serverTimestamp(),
      processedEventIds,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!paymentSnap.exists) {
      paymentPayload.createdAt = FieldValue.serverTimestamp();
    }
    tx.set(paymentRef, stripUndefined(paymentPayload), { merge: true });

    return {
      ok: true,
      alreadyProcessed: false,
      order: {
        ...order,
        commitmentFeeStatus: "paid",
        codAmountPaid: amountNaira,
        codBalance: balance,
        paymentStatus: "pending",
        orderStatus: "processing",
        status: "processing",
        paymentGateway: gateway,
        paymentReference: verified.reference,
        paymentId: paymentRef.id,
        inventoryReserved: true,
        timeline,
      },
    };
  });
}

async function markPaymentFailed({
  orderId,
  reference,
  status,
  reason,
  eventId,
  paymentDocId,
}) {
  const db = getFirestore();
  return db.runTransaction(async (tx) => {
    const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (orderSnap.exists && storeFrom(orderSnap.data()) !== "shopbeta")
      throw new Error("Legacy handler store mismatch.");
    if (!orderSnap.exists) return { ok: false, reason: "Order not found." };
    const order = { id: orderSnap.id, ...orderSnap.data() };
    if (storeFrom(order) !== "shopbeta")
      throw new Error("Legacy handler store mismatch.");
    if (order.paymentStatus === "paid") {
      return { ok: true, order, alreadyProcessed: true };
    }

    const timeline = appendTimeline(order.timeline, "payment_failed", reason);
    tx.update(orderRef, {
      paymentStatus: status,
      ...(reference ? { paymentReference: reference } : {}),
      timeline,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (paymentDocId) {
      const paymentRef = db.collection(COLLECTIONS.payments).doc(paymentDocId);
      const paymentSnap = await tx.get(paymentRef);
      if (paymentSnap.exists) {
        const processed = Array.isArray(paymentSnap.data().processedEventIds)
          ? [...paymentSnap.data().processedEventIds]
          : [];
        if (eventId && processed.includes(eventId)) {
          return { ok: true, order, alreadyProcessed: true };
        }
        if (eventId) processed.push(eventId);
        tx.update(paymentRef, {
          status,
          processedEventIds: processed,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return {
      ok: true,
      order: { ...order, paymentStatus: status, timeline },
      alreadyProcessed: false,
    };
  });
}

function buildMakePayload(order, reference) {
  const lines = order.products || order.items || [];
  const address = order.shippingAddress || {};
  return {
    storeId: "shopbeta",
    storeName: order.storeName || "ShopBeta",
    customerName: order.customer?.name || "Customer",
    customerEmail: order.customer?.email || "",
    phoneNumber: order.customer?.phone || address.phone || "",
    orderId: order.orderNumber || order.id,
    orderDate:
      order.createdAt?.toDate?.()?.toISOString?.() ||
      (order.createdAt instanceof Date
        ? order.createdAt.toISOString()
        : new Date().toISOString()),
    expectedDelivery: "3–5 business days",
    shippingAddress: [
      address.recipientName || address.fullName,
      address.addressLine || address.line1,
      address.addressLine2 || address.line2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ]
      .filter(Boolean)
      .join(", "),
    products: lines.map((item) => {
      const price = Number(item.unitPrice ?? item.lineTotal ?? 0);
      const quantity = Number(item.quantity ?? 0);
      return {
        productName: item.name || item.productId,
        quantity,
        price,
        subtotal:
          item.lineTotal != null ? Number(item.lineTotal) : price * quantity,
      };
    }),
    subtotal: Number(order.subtotal ?? order.totals?.subtotal ?? 0),
    deliveryFee: Number(
      order.deliveryFee ?? order.shipping ?? order.totals?.deliveryFee ?? 0,
    ),
    discount: Number(order.discount ?? order.totals?.discount ?? 0),
    totalPrice: Number(order.total ?? order.totals?.total ?? 0),
    paymentStatus: String(order.paymentStatus || "paid"),
    paymentMethod: String(order.paymentMethod || "card"),
    currency: "NGN",
    reference,
    orderStatus: String(order.orderStatus || order.status || "paid"),
  };
}

async function notifyMake(order, reference) {
  const db = getFirestore();
  const privateSettings = (await db.doc("privateStoreSettings/shopbeta").get()).data();
  const legacySettings = (await db.doc("settings/app").get()).data();
  const makeUrl = privateSettings?.makeWebhookUrl || legacySettings?.notifications?.makeWebhookUrl || process.env.MAKE_WEBHOOK_URL;
  if (!makeUrl) {
    log("webhook.make", "Make.com URL not configured — skipped", {
      orderId: order.id,
    });
    return;
  }

  const orderRef = db.collection(COLLECTIONS.orders).doc(order.id);
  const claimed = await db.runTransaction(async (tx) => {
    const current = await tx.get(orderRef);
    const data = current.data();
    if (!data || !["paid", "success"].includes(String(data.paymentStatus)) || ["sent", "sending"].includes(data.makeNotifyStatus)) return false;
    tx.update(orderRef, { makeNotifyStatus: "sending", makeNotifyAttemptedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return;
  const eventId = `shopbeta:${order.id}:payment-confirmed`;
  const snap = await orderRef.get();
  const latest = snap.exists ? snap.data() : {};
  if (latest.makeNotifyStatus === "sent" && latest.makeNotifiedAt) {
    log("webhook.make", "Make.com already notified — skipped", {
      orderId: order.id,
    });
    return;
  }

  try {
    const response = await fetch(makeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": eventId,
      },
      body: JSON.stringify({
        ...buildMakePayload({ ...order, ...latest, id: order.id }, reference),
        eventId,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      await orderRef.set(
        {
          makeNotifyStatus: "failed",
          makeNotifyError: `HTTP ${response.status}: ${text.slice(0, 200)}`,
          makeNotifyAttemptedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      log("webhook.make", "Make.com webhook failed", {
        orderId: order.id,
        status: response.status,
      });
      return;
    }
    await orderRef.set(
      {
        makeNotifyStatus: "sent",
        makeNotifiedAt: FieldValue.serverTimestamp(),
        makeNotifyError: FieldValue.delete(),
        makeNotifyAttemptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    log("webhook.make", "Make.com webhook succeeded", { orderId: order.id });
  } catch (error) {
    await orderRef.set(
      {
        makeNotifyStatus: "failed",
        makeNotifyError: String(error?.message || error).slice(0, 240),
        makeNotifyAttemptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    log("webhook.make", "Make.com webhook exception", {
      orderId: order.id,
      message: String(error?.message || error),
    });
  }
}

module.exports = {
  COLLECTIONS,
  COD_FEE_PURPOSE,
  computeCodCommitmentFee,
  log,
  toKobo,
  fromKobo,
  amountsMatch,
  appendTimeline,
  finalizeSuccessfulPayment,
  finalizeCodCommitmentFee,
  markPaymentFailed,
  notifyMake,
};
