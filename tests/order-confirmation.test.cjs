const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loader } = require("./payment-test-helpers.cjs");
const { orderConfirmationCopy } = loader()("@/lib/order-confirmation");

test("pending and processing orders never display a paid confirmation", () => {
  for (const paymentStatus of ["pending", "processing"]) {
    const copy = orderConfirmationCopy({ paymentStatus });
    assert.match(copy.title, /awaiting confirmation/);
    assert.match(copy.description, /not been confirmed/);
  }
});

test("confirmation messaging distinguishes paid, failed, cancelled, refunded and COD balances", () => {
  assert.match(orderConfirmationCopy({ paymentStatus: "paid" }).title, /payment is confirmed/);
  assert.match(orderConfirmationCopy({ paymentStatus: "failed" }).title, /not completed/);
  assert.match(orderConfirmationCopy({ orderStatus: "cancelled" }).title, /not completed/);
  assert.match(orderConfirmationCopy({ paymentStatus: "refunded" }).title, /refunded/);
  const cod = orderConfirmationCopy({ paymentMethod: "cash-on-delivery", paymentStatus: "pending", orderStatus: "confirmed" });
  assert.match(cod.description, /remaining balance/);
  assert.doesNotMatch(cod.title, /payment is confirmed/);
  assert.equal(orderConfirmationCopy(null).title, "Order status");
});
