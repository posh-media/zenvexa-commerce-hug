import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  checkoutInput,
  quote,
  deliveryDefaults,
  validateProduct,
  canTransition,
  verifySignature,
  validatePayment,
} from "../src/core.js";

export const request = (patch = {}) => ({
  key: "request-1",
  items: [{ productId: "rice", quantity: 1 }],
  delivery: {
    recipient: "Sample Buyer",
    phone: "08012345678",
    address: "1 Sample Street",
    landmark: "",
    state: "Lagos",
    zone: "Ikeja",
  },
  paymentMethod: "card",
  promo: "",
  ...patch,
});
export const product = {
  id: "rice",
  title: "Rice",
  category: "Supermarket & Pantry",
  price: 78500,
  oldPrice: 85000,
  stock: 2,
  active: true,
  image: "/rice.jpg",
  sku: "ZVX-RICE-001",
  badge: "",
  vendor: "Supplier",
  specs: ["50kg"],
  description: "Sample product",
};

test("server prices and all Nigerian fees determine totals", () => {
  for (const [state, location] of Object.entries(deliveryDefaults)) {
    const input = checkoutInput(
      request({ delivery: { ...request().delivery, state, zone: location.zones[0] } }),
    );
    const result = quote(input, [product], { ...location, active: true });
    assert.equal(result.total, 78500 + location.fee);
  }
});
test("promo rules preserve rounding and strict NAIJA5K boundary", () => {
  const location = { ...deliveryDefaults.Lagos, active: true };
  assert.equal(
    quote(checkoutInput(request({ promo: " hug10 " })), [product], location).discount,
    7850,
  );
  assert.equal(
    quote(checkoutInput(request({ promo: "NAIJA5K" })), [product], location).discount,
    5000,
  );
  assert.throws(() =>
    quote(checkoutInput(request({ promo: "NAIJA5K" })), [{ ...product, price: 50000 }], location),
  );
});
test("malformed requests, forged totals, duplicate lines and invalid quantities rejected", () => {
  for (const quantity of [-1, 0, 1.5, "2", Infinity, 101])
    assert.throws(() => checkoutInput(request({ items: [{ productId: "rice", quantity }] })));
  for (const patch of [
    { total: 1 },
    { promo: "FREE" },
    { paymentMethod: "fake" },
    { items: [] },
    { items: [request().items[0], request().items[0]] },
    { items: [{ productId: "../staff", quantity: 1 }] },
    { delivery: {} },
  ])
    assert.throws(() => checkoutInput(request(patch)));
});
test("inactive, insufficient stock, invalid prices and delivery rejected", () => {
  const input = checkoutInput(request());
  const location = { ...deliveryDefaults.Lagos, active: true };
  for (const p of [
    null,
    { ...product, active: false },
    { ...product, stock: 0 },
    { ...product, price: -1 },
    { ...product, price: NaN },
  ])
    assert.throws(() => quote(input, [p], location));
  assert.throws(() => quote(input, [product], { ...location, zones: [] }));
});
test("catalogue rejects aggregate category, fractional stock and unsafe image URLs", () => {
  assert.equal(validateProduct(product).price, 78500);
  for (const patch of [
    { category: "All Merchandise" },
    { stock: 1.2 },
    { price: 0 },
    { oldPrice: 1 },
    { image: "javascript:alert(1)" },
    { image: "//evil.test/x" },
  ])
    assert.throws(() => validateProduct({ ...product, ...patch }));
});
test("fulfilment never establishes POD payment and invalid transitions rejected", () => {
  assert.doesNotThrow(() =>
    canTransition(
      { status: "processing", paymentMethod: "pod", paymentStatus: "uncollected" },
      "dispatched",
    ),
  );
  assert.throws(() =>
    canTransition(
      { status: "processing", paymentMethod: "card", paymentStatus: "pending" },
      "dispatched",
    ),
  );
  assert.throws(() =>
    canTransition({ status: "pending_payment", paymentReference: "attempt" }, "cancelled"),
  );
  assert.throws(() => canTransition({ status: "delivered" }, "processing"));
});
test("HMAC verifies raw bytes and rejects tamper, forged and truncated signatures", () => {
  const raw = Buffer.from('{"event":"charge.success"}');
  const secret = "synthetic-test-secret";
  const signature = createHmac("sha512", secret).update(raw).digest("hex");
  assert.equal(verifySignature(raw, signature, secret), true);
  assert.equal(verifySignature(Buffer.from("{}"), signature, secret), false);
  assert.equal(verifySignature(raw, signature.slice(1), secret), false);
  assert.equal(verifySignature(raw, "x".repeat(128), secret), false);
});
test("payment identity, amount, currency, customer and metadata must all match", () => {
  const attempt = {
    reference: "ref",
    orderId: "order",
    amountKobo: 8000000,
    email: "buyer@example.test",
  };
  const order = { id: "order", userId: "buyer", total: 80000, paymentReference: "ref" };
  const payment = {
    reference: "ref",
    amount: 8000000,
    currency: "NGN",
    status: "success",
    customer: { email: attempt.email },
    metadata: { orderId: "order", userId: "buyer" },
  };
  assert.equal(validatePayment(attempt, order, payment), "paid");
  for (const patch of [
    { reference: "other" },
    { amount: 1 },
    { currency: "USD" },
    { metadata: {} },
    { customer: { email: "wrong@example.test" } },
  ])
    assert.throws(() => validatePayment(attempt, order, { ...payment, ...patch }));
  for (const status of ["pending", "failed", "abandoned"])
    assert.equal(validatePayment(attempt, order, { ...payment, status }), status);
  assert.equal(
    validatePayment(attempt, order, { ...payment, status: "reversed" }),
    "review_required",
  );
});
