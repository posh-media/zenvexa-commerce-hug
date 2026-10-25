import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
export function requireValue(ok, message, code = "invalid-argument") {
  if (!ok) throw new DomainError(code, message);
}
export function object(value, keys) {
  requireValue(value && typeof value === "object" && !Array.isArray(value), "Expected an object.");
  requireValue(
    Object.keys(value).every((key) => keys.includes(key)),
    "Unexpected request fields.",
  );
  return value;
}
export function text(value, max = 120, min = 1) {
  requireValue(
    typeof value === "string" && value.trim().length >= min && value.trim().length <= max,
    "Invalid text field.",
  );
  return value.trim();
}
export function id(value) {
  requireValue(
    typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value),
    "Invalid identifier.",
  );
  return value;
}
export function integer(value, min = 0, max = 100000000000) {
  requireValue(
    Number.isSafeInteger(value) && value >= min && value <= max,
    "Invalid numeric value.",
  );
  return value;
}
export const categoryNames = [
  "Phones & Gadgets",
  "Home & Power",
  "Naija Fashion & Style",
  "Supermarket & Pantry",
  "Beauty & Personal Care",
];
export const deliveryDefaults = {
  Lagos: {
    fee: 1500,
    zones: ["Ikeja", "Lekki Phase 1", "Victoria Island", "Surulere", "Yaba", "Ajah"],
    eta: "1 – 2 Business Days",
  },
  "Abuja (FCT)": {
    fee: 2500,
    zones: ["Wuse II", "Maitama", "Garki", "Gwarinpa"],
    eta: "1 – 2 Business Days",
  },
  Rivers: {
    fee: 2800,
    zones: ["Port Harcourt GRA", "Trans-Amadi", "Rumuokoro", "Obio-Akpor"],
    eta: "1 – 2 Business Days",
  },
  Oyo: {
    fee: 2000,
    zones: ["Ibadan North", "Bodija", "Oluyole", "Iwo Road"],
    eta: "1 – 2 Business Days",
  },
  Kano: {
    fee: 3200,
    zones: ["Nassarawa", "Fagge", "Tarauni", "Sabon Gari"],
    eta: "1 – 2 Business Days",
  },
  Enugu: {
    fee: 2700,
    zones: ["Independence Layout", "New Haven", "Enugu North", "Trans-Ekulu"],
    eta: "1 – 2 Business Days",
  },
};
export const deliveryId = (state) => createHash("sha256").update(state).digest("hex").slice(0, 24);
export const fingerprint = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function checkoutInput(raw) {
  object(raw, ["key", "items", "delivery", "paymentMethod", "promo"]);
  const key = id(raw.key);
  requireValue(
    Array.isArray(raw.items) && raw.items.length > 0 && raw.items.length <= 30,
    "Choose 1–30 products.",
  );
  const items = raw.items
    .map((line) => {
      object(line, ["productId", "quantity"]);
      return { productId: id(line.productId), quantity: integer(line.quantity, 1, 100) };
    })
    .sort((a, b) => a.productId.localeCompare(b.productId));
  requireValue(
    new Set(items.map((line) => line.productId)).size === items.length,
    "Duplicate product lines.",
  );
  const d = object(raw.delivery, ["recipient", "phone", "address", "landmark", "state", "zone"]);
  const phone = text(d.phone, 20).replace(/[\s-]/g, "");
  requireValue(/^(\+234|0)[789][01]\d{8}$/.test(phone), "Enter a valid Nigerian mobile number.");
  const delivery = {
    recipient: text(d.recipient),
    phone,
    address: text(d.address, 500),
    landmark: text(d.landmark, 200, 0),
    state: text(d.state, 50),
    zone: text(d.zone, 80),
  };
  requireValue(
    ["card", "transfer", "ussd", "pod"].includes(raw.paymentMethod),
    "Unsupported payment method.",
  );
  const promo = text(raw.promo ?? "", 20, 0).toUpperCase();
  requireValue(["", "HUG10", "NAIJA5K"].includes(promo), "Unknown promo code.");
  return { key, items, delivery, paymentMethod: raw.paymentMethod, promo };
}
export function quote(input, products, location) {
  requireValue(
    location && location.active === true && location.zones.includes(input.delivery.zone),
    "Unsupported delivery selection.",
  );
  const fee = integer(location.fee, 0, 1000000);
  const items = input.items.map((line, i) => {
    const p = products[i];
    requireValue(p && p.active === true, "A product is unavailable.", "failed-precondition");
    integer(p.stock, 0, 1000000);
    requireValue(
      p.stock >= line.quantity,
      "Insufficient stock. Refresh your bag.",
      "failed-precondition",
    );
    const unitPrice = integer(p.price, 1, 100000000);
    return {
      productId: line.productId,
      quantity: line.quantity,
      unitPrice,
      lineTotal: integer(unitPrice * line.quantity),
      title: p.title,
      image: p.image,
      sku: p.sku,
    };
  });
  const subtotal = integer(items.reduce((n, line) => n + line.lineTotal, 0));
  requireValue(
    input.promo !== "NAIJA5K" || subtotal > 50000,
    "NAIJA5K requires merchandise above ₦50,000.",
  );
  const discount =
    input.promo === "HUG10" ? Math.round(subtotal * 0.1) : input.promo === "NAIJA5K" ? 5000 : 0;
  return {
    items,
    subtotal,
    discount,
    deliveryFee: fee,
    total: integer(subtotal - discount + fee, 1),
    currency: "NGN",
    eta: text(location.eta, 80),
  };
}
export function validateProduct(raw) {
  object(raw, [
    "id",
    "title",
    "category",
    "price",
    "oldPrice",
    "badge",
    "vendor",
    "specs",
    "description",
    "image",
    "sku",
    "stock",
    "rating",
    "reviews",
    "active",
    "slug",
    "shortDescription",
    "categoryId",
    "currency",
    "images",
    "featured",
    "imageStatus",
    "imageNotes",
    "version",
    "reviewSource",
  ]);
  requireValue(categoryNames.includes(raw.category), "Invalid category.");
  requireValue(Array.isArray(raw.specs) && raw.specs.length <= 20, "Invalid specifications.");
  const price = integer(raw.price, 1, 100000000);
  const oldPrice = integer(raw.oldPrice, price, 100000000);
  const image = text(raw.image, 500000);
  const emulatorImage =
    /^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "") &&
    /^http:\/\/(127\.0\.0\.1|localhost):9199\/v0\/b\//.test(image);
  requireValue(
    emulatorImage || /^https:\/\//.test(image) || /^\/(?!\/)/.test(image),
    "Unsupported image URL or type.",
  );
  const images = raw.images ?? [image];
  requireValue(
    Array.isArray(images) && images.length > 0 && images.length <= 8 && images[0] === image,
    "Primary image must be first in a gallery of 1–8 images.",
  );
  for (const url of images)
    requireValue(
      typeof url === "string" &&
        url.length <= 2048 &&
        (/^https:\/\//.test(url) ||
          /^\/(?!\/)/.test(url) ||
          (emulatorImage && url.startsWith("http://127.0.0.1:9199/"))),
      "Invalid gallery image.",
    );
  requireValue(raw.currency === undefined || raw.currency === "NGN", "Only NGN is supported.");
  return {
    slug: id(raw.slug || raw.id).toLowerCase(),
    shortDescription: text(raw.shortDescription ?? "", 500, 0),
    categoryId: deliveryId(raw.category),
    currency: "NGN",
    images,
    featured: raw.featured === true,
    imageStatus: ["verified", "missing", "unverified"].includes(raw.imageStatus)
      ? raw.imageStatus
      : "unverified",
    imageNotes: text(raw.imageNotes ?? "", 500, 0),
    id: id(raw.id),
    title: text(raw.title, 200),
    category: raw.category,
    price,
    oldPrice,
    badge: text(raw.badge, 80, 0),
    vendor: text(raw.vendor),
    specs: raw.specs.map((s) => text(s, 300)),
    description: text(raw.description, 5000),
    image,
    sku: id(raw.sku).toUpperCase(),
    stock: integer(raw.stock, 0, 1000000),
    active: raw.active !== false,
  };
}
export function canTransition(order, next) {
  const allowed = {
    pending_payment: ["cancelled"],
    processing: ["dispatched", "cancelled"],
    dispatched: ["delivered"],
    delivered: [],
    cancelled: [],
    refunded: [],
  };
  requireValue(
    allowed[order.status]?.includes(next),
    "Invalid order transition.",
    "failed-precondition",
  );
  requireValue(
    next !== "dispatched" || order.paymentMethod === "pod" || order.paymentStatus === "paid",
    "Payment must be verified before dispatch.",
    "failed-precondition",
  );
  requireValue(
    next !== "cancelled" || !["paid", "collected"].includes(order.paymentStatus),
    "Paid orders require reconciliation/refund, not cancellation.",
    "failed-precondition",
  );
  requireValue(
    next !== "cancelled" || !order.paymentReference,
    "Reconcile the payment attempt before releasing stock.",
    "failed-precondition",
  );
}
export function verifySignature(raw, signature, secret) {
  if (!secret || typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function validatePayment(attempt, order, payment) {
  requireValue(
    payment.reference === attempt.reference &&
      attempt.orderId === order.id &&
      order.paymentReference === attempt.reference,
    "Payment identity mismatch.",
    "failed-precondition",
  );
  requireValue(
    payment.amount === attempt.amountKobo &&
      payment.amount === order.total * 100 &&
      payment.currency === "NGN",
    "Payment amount/currency mismatch.",
    "failed-precondition",
  );
  requireValue(
    payment.metadata?.orderId === order.id && payment.metadata?.userId === order.userId,
    "Payment association mismatch.",
    "failed-precondition",
  );
  requireValue(
    payment.customer?.email?.toLowerCase() === attempt.email.toLowerCase(),
    "Payment customer mismatch.",
    "failed-precondition",
  );
  requireValue(
    ["success", "failed", "abandoned", "pending", "ongoing", "processing", "reversed"].includes(
      payment.status,
    ),
    "Unsupported payment status.",
    "failed-precondition",
  );
  return payment.status === "success"
    ? "paid"
    : ["failed", "abandoned"].includes(payment.status)
      ? payment.status
      : payment.status === "reversed"
        ? "review_required"
        : "pending";
}
