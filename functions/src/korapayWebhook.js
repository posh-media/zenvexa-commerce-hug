const { routeStoreWebhook, storeFrom } = require("./store-routing");
/**
 * KoraPay Webhook Cloud Function
 * Handles KoraPay payment webhook events
 * Mirrors src/app/api/payments/korapay/webhook/route.ts behaviour:
 * signature → KoraPay verify API → atomic Firestore → Make.com (best-effort).
 */
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { createHmac, timingSafeEqual } = require("crypto");
const { stripUndefined } = require("./stripUndefined");
const { getKorapaySecretKey } = require("./env");

const COLLECTIONS = {
  orders: "orders",
  payments: "payments",
  products: "products",
};

const SUPPORTED = new Set([
  "charge.success",
  "charge.failed",
  "transfer.success",
  "refund.processed",
]);

const COD_FEE_PURPOSE = "cod_commitment_fee";

function computeCodCommitmentFee(orderTotal) {
  const total = Number(orderTotal);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.ceil(total * 0.25);
}

const KORAPAY_BASE = "https://api.korapay.com/merchant/api/v1";

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

async function korapayFetch(path) {
  const secret = getKorapaySecretKey();
  const response = await fetch(`${KORAPAY_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  const body = await response.json();
  if (!response.ok || !body.status) {
    throw new Error(body.message || `KoraPay error (${response.status})`);
  }
  return body;
}

function verifyKorapayWebhookSignature(payload, signature) {
  if (!signature) return false;
  const secret = getKorapaySecretKey();
  if (!secret) {
    log("webhook.signature", "KORAPAY_SECRET_KEY not configured", {});
    return false;
  }

  // KoraPay signature is HMAC-SHA256 of the data object only (per official docs)
  const dataString = JSON.stringify(payload.data);
  const hash = createHmac("sha256", secret).update(dataString).digest("hex");
  try {
    const expected = Buffer.from(hash, "utf8");
    const provided = Buffer.from(signature, "utf8");
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}

function mapKorapayStatus(status) {
  const normalized = status.toLowerCase();
  if (normalized === "success" || normalized === "successful") return "paid";
  if (normalized === "failed" || normalized === "failure") return "failed";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "refunded") return "refunded";
  if (normalized === "pending" || normalized === "processing")
    return "processing";
  return "pending";
}

// KoraPay returns amounts in Naira, not kobo
function fromNaira(amountNaira) {
  return amountNaira;
}

function amountsMatch(expectedNaira, paidNaira) {
  return Math.abs(expectedNaira - paidNaira) < 1; // Allow 1 Naira tolerance
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
  orderId,
  verified,
  paymentDocId,
  eventId,
}) {
  const db = getFirestore();
  const amountNaira = fromNaira(verified.amount);

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
        timeline,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );

    const paymentPayload = {
      orderId: order.id,
      orderNumber: order.orderNumber || null,
      userId: order.userId,
      gateway: "korapay",
      reference: verified.reference,
      amount: amountNaira,
      currency: verified.currency || "NGN",
      status: "paid",
      customerEmail: verified.customer?.email || null,
      gatewayResponse: verified,
      verificationData: verified,
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
  orderId,
  verified,
  paymentDocId,
  eventId,
}) {
  const db = getFirestore();
  const amountNaira = fromNaira(verified.amount);

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
        paymentGateway: "korapay",
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
      gateway: "korapay",
      purpose: COD_FEE_PURPOSE,
      reference: verified.reference,
      amount: amountNaira,
      currency: verified.currency || "NGN",
      status: "paid",
      customerEmail: verified.customer?.email || null,
      gatewayResponse: verified,
      verificationData: verified,
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
        paymentGateway: "korapay",
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
    paymentMethod: String(order.paymentMethod || "korapay"),
    currency: "NGN",
    reference,
    orderStatus: String(order.orderStatus || order.status || "paid"),
  };
}

async function notifyMake(order, reference) {
  const makeUrl = process.env.MAKE_WEBHOOK_URL;
  if (!makeUrl) {
    log("webhook.make", "Make.com URL not configured — skipped", {
      orderId: order.id,
    });
    return;
  }

  const db = getFirestore();
  const orderRef = db.collection(COLLECTIONS.orders).doc(order.id);
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
      },
      body: JSON.stringify(
        buildMakePayload({ ...order, ...latest, id: order.id }, reference),
      ),
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

exports.korapayWebhook = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    try {
      if (await routeStoreWebhook(req, res, "korapay")) return;
    } catch {
      res
        .status(503)
        .json({ ok: false, reason: "Store webhook routing unavailable." });
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, reason: "Method not allowed." });
      return;
    }

    const signature = req.get("x-korapay-signature");

    log("webhook.incoming", "KoraPay webhook received", {
      hasSignature: Boolean(signature),
    });

    if (!getKorapaySecretKey()) {
      log("webhook.failure", "KORAPAY_SECRET_KEY not configured", {});
      res.status(500).json({ ok: false, reason: "KoraPay is not configured." });
      return;
    }

    let payload;
    try {
      payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      res.status(400).json({ ok: false, reason: "Invalid JSON." });
      return;
    }

    if (!verifyKorapayWebhookSignature(payload, signature)) {
      log("webhook.signature", "Invalid KoraPay signature", {
        hint: "Check Firebase KORAPAY_SECRET_KEY matches KoraPay dashboard mode (test vs live).",
      });
      res.status(401).json({ ok: false, reason: "Invalid signature." });
      return;
    }
    log("webhook.signature", "Signature valid", {});

    const event = payload.event || "";
    const data = payload.data;
    log("webhook.event", "Parsed KoraPay event", {
      event,
      reference: data?.reference,
      korapayId: data?.id,
    });

    if (!data?.reference) {
      res.status(200).json({ ok: true, ignored: true });
      return;
    }
    if (!SUPPORTED.has(event)) {
      res.status(200).json({ ok: true, ignored: true, event });
      return;
    }

    const eventId = `${event}:${data.id ?? data.reference}`;
    const db = getFirestore();

    try {
      const paymentSnap = await db
        .collection(COLLECTIONS.payments)
        .where("reference", "==", data.reference)
        .limit(1)
        .get();
      const paymentDoc = paymentSnap.empty ? null : paymentSnap.docs[0];
      const paymentDocId = paymentDoc?.id;
      const orderId = paymentDoc?.data()?.orderId || data.metadata?.orderId;

      if (!orderId) {
        log("webhook.ignored", "Order not found for reference", {
          reference: data.reference,
        });
        res
          .status(200)
          .json({ ok: true, ignored: true, reason: "order_not_found" });
        return;
      }

      if (event === "charge.success") {
        let verified;
        try {
          verified = await korapayFetch(`/transactions/${data.reference}`);
        } catch (error) {
          log("webhook.verify", "KoraPay verify API failed", {
            reference: data.reference,
            message: error.message,
          });
          res.status(502).json({ ok: false, reason: "Verification failed." });
          return;
        }

        const status = mapKorapayStatus(verified.data.status);
        log("webhook.verify", "KoraPay verification result", {
          reference: verified.data.reference,
          status: verified.data.status,
          amountNaira: verified.data.amount,
          currency: verified.data.currency,
          customerEmail: verified.data.customer?.email,
          mappedStatus: status,
        });

        if (status !== "paid") {
          res
            .status(200)
            .json({ ok: true, ignored: true, reason: "not_successful" });
          return;
        }

        const orderSnap = await db
          .collection(COLLECTIONS.orders)
          .doc(orderId)
          .get();
        if (!orderSnap.exists) {
          res
            .status(200)
            .json({ ok: true, ignored: true, reason: "order_missing" });
          return;
        }
        const order = { id: orderSnap.id, ...orderSnap.data() };
        if (storeFrom(order) !== "shopbeta")
          throw new Error("Legacy handler store mismatch.");
        const isCodFee =
          paymentDoc?.data()?.purpose === COD_FEE_PURPOSE ||
          data.metadata?.purpose === COD_FEE_PURPOSE;
        const orderTotal = Number(order.total ?? order.totals?.total ?? 0);
        const expectedTotal = isCodFee
          ? Number(
              order.codCommitmentFee ?? computeCodCommitmentFee(orderTotal),
            )
          : orderTotal;
        if (!amountsMatch(expectedTotal, verified.data.amount)) {
          log("webhook.failure", "Amount mismatch after verify", {
            orderId,
            expectedTotal,
            paidNaira: verified.data.amount,
          });
          res.status(400).json({ ok: false, reason: "Amount mismatch." });
          return;
        }
        if ((verified.data.currency || "NGN").toUpperCase() !== "NGN") {
          res.status(400).json({ ok: false, reason: "Currency mismatch." });
          return;
        }
        const orderEmail = order.customer?.email?.trim().toLowerCase();
        const paidEmail = verified.data.customer?.email?.trim().toLowerCase();
        if (orderEmail && paidEmail && orderEmail !== paidEmail) {
          res
            .status(400)
            .json({ ok: false, reason: "Customer email mismatch." });
          return;
        }

        log("webhook.firestore", "Finalizing successful payment", {
          orderId,
          eventId,
        });
        const result = isCodFee
          ? await finalizeCodCommitmentFee({
              orderId,
              verified: verified.data,
              paymentDocId,
              eventId,
            })
          : await finalizeSuccessfulPayment({
              orderId,
              verified: verified.data,
              paymentDocId,
              eventId,
            });
        if (!result.ok) {
          log("webhook.firestore", "Firestore finalize failed", {
            orderId,
            reason: result.reason,
          });
          res.status(500).json({ ok: false, reason: result.reason });
          return;
        }

        log("webhook.firestore", "Firestore updated", {
          orderId,
          alreadyProcessed: result.alreadyProcessed,
        });

        await notifyMake(result.order, verified.data.reference);

        log("webhook.success", "charge.success handled", {
          orderId,
          reference: verified.data.reference,
          alreadyProcessed: result.alreadyProcessed,
        });
        res.status(200).json({
          ok: true,
          alreadyProcessed: result.alreadyProcessed,
          orderId,
          reference: verified.data.reference,
        });
        return;
      }

      if (event === "charge.failed") {
        const result = await markPaymentFailed({
          orderId,
          reference: data.reference,
          status: "failed",
          reason: data.status,
          eventId,
          paymentDocId,
        });
        res.status(200).json({
          ok: result.ok,
          alreadyProcessed: result.alreadyProcessed || false,
        });
        return;
      }

      if (event === "refund.processed") {
        const orderRef = db.collection(COLLECTIONS.orders).doc(orderId);
        await db.runTransaction(async (tx) => {
          const orderSnap = await tx.get(orderRef);
          if (orderSnap.exists && storeFrom(orderSnap.data()) !== "shopbeta")
            throw new Error("Legacy handler store mismatch.");
          if (!orderSnap.exists) return;
          if (paymentDocId) {
            const paymentRef = db
              .collection(COLLECTIONS.payments)
              .doc(paymentDocId);
            const paymentSnap = await tx.get(paymentRef);
            if (paymentSnap.exists) {
              const processed = Array.isArray(
                paymentSnap.data().processedEventIds,
              )
                ? [...paymentSnap.data().processedEventIds]
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
        res.status(200).json({ ok: true, event });
        return;
      }

      // transfer.success — prepared
      res.status(200).json({ ok: true, event, acknowledged: true });
    } catch (error) {
      log("webhook.failure", "Unhandled webhook error", {
        message: error?.message || String(error),
      });
      res.status(500).json({ ok: false, reason: "Webhook processing failed." });
    }
  },
);
