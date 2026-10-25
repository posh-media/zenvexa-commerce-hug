import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  checkoutInput,
  quote,
  deliveryId,
  fingerprint,
  requireValue,
  id,
  validateProduct,
  canTransition,
  validatePayment,
  text,
  integer,
  object,
} from "./core.js";

export function commerceService(db) {
  const stamp = () => FieldValue.serverTimestamp();
  async function staff(tx, uid, roles) {
    const record = await tx.get(db.doc(`staff/${uid}`));
    requireValue(
      record.exists && record.data().active === true && roles.includes(record.data().role),
      "Staff permission required.",
      "permission-denied",
    );
  }
  async function createOrder(uid, raw) {
    const input = checkoutInput(raw);
    const orderId = fingerprint([uid, input.key]);
    const hash = fingerprint(input);
    const ref = db.doc(`orders/${orderId}`);
    return db.runTransaction(async (tx) => {
      const prior = await tx.get(ref);
      if (prior.exists) {
        requireValue(
          prior.data().requestHash === hash,
          "Idempotency key already used for different details.",
          "already-exists",
        );
        return { id: orderId, ...prior.data() };
      }
      const location = await tx.get(db.doc(`deliveryZones/${deliveryId(input.delivery.state)}`));
      const productRefs = input.items.map((line) => db.doc(`products/${line.productId}`));
      const products = await tx.getAll(...productRefs);
      const limitRef = db.doc(`requestLimits/${uid}`);
      const limit = await tx.get(limitRef);
      const now = Date.now();
      const recent = limit.exists && now - limit.data().start < 3600000;
      requireValue(
        !recent || limit.data().count < 20,
        "Order limit reached. Try again later.",
        "resource-exhausted",
      );
      const totals = quote(
        input,
        products.map((p) => (p.exists ? p.data() : null)),
        location.exists ? location.data() : null,
      );
      const order = {
        id: orderId,
        userId: uid,
        source: "checkout",
        isTest: !!process.env.FIRESTORE_EMULATOR_HOST,
        requestHash: hash,
        ...totals,
        delivery: input.delivery,
        promo: input.promo,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "pod" ? "uncollected" : "pending",
        status: input.paymentMethod === "pod" ? "processing" : "pending_payment",
        inventoryState: "reserved",
        expiresAt: Timestamp.fromMillis(now + 30 * 60000),
        createdAt: stamp(),
        updatedAt: stamp(),
      };
      tx.set(limitRef, {
        start: recent ? limit.data().start : now,
        count: recent ? limit.data().count + 1 : 1,
      });
      productRefs.forEach((p, i) => {
        const line = input.items[i];
        tx.update(p, { stock: products[i].data().stock - line.quantity, updatedAt: stamp() });
        tx.create(db.doc(`inventoryEvents/${orderId}_${line.productId}_reserve`), {
          orderId,
          productId: line.productId,
          delta: -line.quantity,
          reason: "reserve",
          actor: uid,
          createdAt: stamp(),
        });
      });
      tx.create(ref, order);
      tx.create(ref.collection("events").doc("created"), {
        type: order.status,
        actor: uid,
        createdAt: stamp(),
      });
      return { ...order, createdAt: null, updatedAt: null };
    });
  }
  async function saveProduct(uid, raw) {
    object(raw, ["product", "expectedStock", "expectedVersion", "reason"]);
    const product = validateProduct(raw.product);
    await db.runTransaction(async (tx) => {
      await staff(tx, uid, ["admin", "inventory"]);
      const ref = db.doc(`products/${product.id}`);
      const prior = await tx.get(ref);
      requireValue(
        prior.exists ? raw.expectedStock === prior.data().stock : raw.expectedStock === null,
        "Inventory changed. Reload before saving.",
        "aborted",
      );
      if (raw.expectedVersion !== undefined)
        requireValue(
          (prior.exists ? (prior.data().version ?? 0) : 0) === raw.expectedVersion,
          "Product changed. Reload before saving.",
          "aborted",
        );
      const skuRef = db.doc(`productKeys/sku-${fingerprint(product.sku)}`);
      const slugRef = db.doc(`productKeys/slug-${fingerprint(product.slug)}`);
      const [skuLock, slugLock] = await tx.getAll(skuRef, slugRef);
      const duplicates = await tx.get(
        db.collection("products").where("sku", "==", product.sku).limit(2),
      );
      requireValue(
        (!skuLock.exists || skuLock.data().productId === product.id) &&
          duplicates.docs.every((d) => d.id === product.id),
        "SKU already belongs to another product.",
        "already-exists",
      );
      requireValue(
        !slugLock.exists || slugLock.data().productId === product.id,
        "Slug already belongs to another product.",
        "already-exists",
      );
      const delta = product.stock - (prior.exists ? prior.data().stock : 0);
      if (prior.exists && delta !== 0)
        requireValue(
          typeof raw.reason === "string" && raw.reason.trim().length >= 5,
          "Explain the stock adjustment.",
        );
      const reason = raw.reason
        ? text(raw.reason, 300, 5)
        : prior.exists
          ? "catalogue_edit"
          : "opening_stock";
      const { stock: _stock, ...details } = product;
      tx.set(skuRef, { productId: product.id });
      tx.set(slugRef, { productId: product.id });
      tx.set(ref, {
        ...product,
        version: (prior.exists ? (prior.data().version ?? 0) : 0) + 1,
        searchTokens: [
          ...new Set([
            product.id,
            product.sku.toLowerCase(),
            ...`${product.title} ${product.category}`
              .toLowerCase()
              .split(/\s+/)
              .flatMap((word) =>
                Array.from({ length: Math.min(word.length, 30) }, (_, i) => word.slice(0, i + 1)),
              ),
          ]),
        ].slice(0, 400),
        createdAt: prior.exists ? (prior.data().createdAt ?? stamp()) : stamp(),
        reviewSource: prior.exists ? (prior.data().reviewSource ?? "unverified") : "none",
        rating: prior.exists ? (prior.data().rating ?? 0) : 0,
        reviews: prior.exists ? (prior.data().reviews ?? 0) : 0,
        updatedAt: stamp(),
      });
      tx.create(db.collection("inventoryEvents").doc(), {
        productId: product.id,
        delta,
        reason,
        actor: uid,
        createdAt: stamp(),
      });
      tx.create(db.collection("auditLogs").doc(), {
        action: "product.save",
        productId: product.id,
        details,
        actor: uid,
        createdAt: stamp(),
      });
    });
    return { id: product.id };
  }
  async function transition(uid, raw) {
    const orderId = id(raw.orderId);
    const next = text(raw.status, 30);
    return db.runTransaction(async (tx) => {
      await staff(tx, uid, ["admin", "orders"]);
      const ref = db.doc(`orders/${orderId}`);
      const snap = await tx.get(ref);
      requireValue(snap.exists, "Order not found.", "not-found");
      const order = snap.data();
      if (order.status === next) return { status: next };
      canTransition(order, next);
      const release = next === "cancelled" && order.inventoryState === "reserved";
      const refs = release ? order.items.map((line) => db.doc(`products/${line.productId}`)) : [];
      const products = refs.length ? await tx.getAll(...refs) : [];
      products.forEach((p, i) => {
        requireValue(p.exists, "Inventory requires reconciliation.", "failed-precondition");
        tx.update(refs[i], {
          stock: integer(p.data().stock + order.items[i].quantity, 0, 1000000),
          updatedAt: stamp(),
        });
        tx.create(db.doc(`inventoryEvents/${orderId}_${order.items[i].productId}_release`), {
          orderId,
          productId: order.items[i].productId,
          delta: order.items[i].quantity,
          reason: "cancel",
          actor: uid,
          createdAt: stamp(),
        });
      });
      tx.update(ref, {
        status: next,
        inventoryState: release
          ? "released"
          : next === "delivered"
            ? "consumed"
            : order.inventoryState,
        updatedAt: stamp(),
      });
      tx.create(ref.collection("events").doc(next), { type: next, actor: uid, createdAt: stamp() });
      return { status: next };
    });
  }
  async function collectPod(uid, raw) {
    const ref = db.doc(`orders/${id(raw.orderId)}`);
    const receipt = text(raw.receipt, 120);
    await db.runTransaction(async (tx) => {
      await staff(tx, uid, ["admin"]);
      const snap = await tx.get(ref);
      requireValue(snap.exists, "Order not found.", "not-found");
      const order = snap.data();
      requireValue(
        order.paymentMethod === "pod" && order.status === "delivered",
        "Only delivered POD orders can be collected.",
        "failed-precondition",
      );
      if (order.paymentStatus === "collected") return;
      tx.update(ref, {
        paymentStatus: "collected",
        collectionReceipt: receipt,
        collectedAt: stamp(),
        updatedAt: stamp(),
      });
      tx.create(ref.collection("events").doc("collected"), {
        type: "pod_collected",
        actor: uid,
        receipt,
        createdAt: stamp(),
      });
    });
    return { ok: true };
  }
  async function preparePayment(uid, orderId, email) {
    const ref = db.doc(`orders/${id(orderId)}`);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      requireValue(
        snap.exists && snap.data().userId === uid,
        "Order not found.",
        "permission-denied",
      );
      const order = snap.data();
      requireValue(
        order.status === "pending_payment" &&
          order.paymentMethod !== "pod" &&
          order.expiresAt.toMillis() > Date.now(),
        "Order is not payable.",
        "failed-precondition",
      );
      const reference = order.paymentReference || `ZVX-${fingerprint([orderId, uid]).slice(0, 40)}`;
      const attemptRef = db.doc(`paymentAttempts/${reference}`);
      const prior = await tx.get(attemptRef);
      if (prior.exists) return prior.data();
      const attempt = {
        orderId,
        userId: uid,
        reference,
        email,
        amountKobo: integer(order.total * 100, 1),
        currency: "NGN",
        status: "initializing",
        paymentMethod: order.paymentMethod,
        createdAt: stamp(),
      };
      tx.create(attemptRef, attempt);
      tx.update(ref, { paymentReference: reference, updatedAt: stamp() });
      return attempt;
    });
  }
  async function applyPayment(reference, payment) {
    const ref = db.doc(`paymentAttempts/${id(reference)}`);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      requireValue(snap.exists, "Payment not found.", "not-found");
      const attempt = snap.data();
      const orderRef = db.doc(`orders/${attempt.orderId}`);
      const orderSnap = await tx.get(orderRef);
      requireValue(orderSnap.exists, "Order not found.", "not-found");
      const order = orderSnap.data();
      const status = validatePayment(attempt, order, payment);
      if (["paid", "refunded"].includes(order.paymentStatus))
        return { status: order.paymentStatus };
      requireValue(
        order.inventoryState === "reserved" && order.status === "pending_payment",
        "Order requires manual reconciliation.",
        "failed-precondition",
      );
      tx.update(ref, { status, updatedAt: stamp() });
      tx.update(orderRef, {
        paymentStatus: status,
        ...(status === "paid" ? { status: "processing", paidAt: stamp() } : {}),
        updatedAt: stamp(),
      });
      tx.set(orderRef.collection("events").doc(`payment_${status}`), {
        type: `payment_${status}`,
        actor: "paystack",
        createdAt: stamp(),
      });
      return { status };
    });
  }
  async function applyRefund(reference, refund) {
    const ref = db.doc(`paymentAttempts/${id(reference)}`);
    await db.runTransaction(async (tx) => {
      const attempt = await tx.get(ref);
      requireValue(attempt.exists, "Payment not found.", "not-found");
      const orderRef = db.doc(`orders/${attempt.data().orderId}`);
      const order = await tx.get(orderRef);
      requireValue(
        order.exists && ["paid", "refunded"].includes(order.data().paymentStatus),
        "Payment is not refundable.",
        "failed-precondition",
      );
      requireValue(
        refund.status === "processed" &&
          refund.amount === attempt.data().amountKobo &&
          refund.currency === "NGN" &&
          refund.transaction?.reference === reference,
        "Refund requires reconciliation.",
        "failed-precondition",
      );
      if (order.data().paymentStatus === "refunded") return;
      tx.update(ref, { status: "refunded", updatedAt: stamp() });
      tx.update(orderRef, { paymentStatus: "refunded", status: "refunded", updatedAt: stamp() });
      tx.create(orderRef.collection("events").doc("refunded"), {
        type: "refunded",
        actor: "paystack",
        createdAt: stamp(),
      });
    });
    return { status: "refunded" };
  }
  return {
    createOrder,
    saveProduct,
    transition,
    collectPod,
    preparePayment,
    applyPayment,
    applyRefund,
  };
}
