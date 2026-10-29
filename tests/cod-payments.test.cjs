process.env.NEXT_PUBLIC_STORE_ID = "shopbeta";
process.env.STORE_ID = "shopbeta";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loader, database } = require("./payment-test-helpers.cjs");

// Pure COD helpers — no mocks needed.
const {
  computeCodCommitmentFee,
  normalizeStateName,
  normalizeAllowedStates,
  isCodStateAllowed,
  COD_FEE_PURPOSE,
} = loader()("@/lib/cod");

test("commitment fee is 25% of the total rounded up", () => {
  assert.equal(computeCodCommitmentFee(10000), 2500);
  assert.equal(computeCodCommitmentFee(9999), 2500); // ceil
  assert.equal(computeCodCommitmentFee(40001), 10001);
  assert.equal(computeCodCommitmentFee(0), 0);
  assert.equal(computeCodCommitmentFee(-500), 0);
  assert.equal(computeCodCommitmentFee(NaN), 0);
});

test("state names are trimmed and compared case-insensitively", () => {
  assert.equal(normalizeStateName("  Lagos  "), "lagos");
  assert.equal(normalizeStateName("Abuja  FCT"), "abuja fct");
  assert.deepEqual(normalizeAllowedStates([" Lagos ", "lagos", "ABUJA", ""]), [
    "Lagos",
    "ABUJA",
  ]);
  assert.ok(isCodStateAllowed(["Lagos"], "LAGOS"));
  assert.ok(isCodStateAllowed([" Rivers State "], "rivers state"));
  assert.ok(!isCodStateAllowed(["Lagos"], "Kano"));
  assert.ok(!isCodStateAllowed([], "Lagos"));
  assert.ok(!isCodStateAllowed(["Lagos"], "  "));
});

// Finalization lifecycle against the in-memory Firestore.
const PRODUCTS = {
  "products/p1": { stock: 10, salesCount: 0, active: true },
};

const COD_ORDER = {
  orderNumber: "SB-COD1",
  userId: "u1",
  paymentMethod: "cash-on-delivery",
  paymentStatus: "pending",
  orderStatus: "pending",
  total: 10000,
  codCommitmentFee: 2500,
  commitmentFeeStatus: "processing",
  customer: { email: "buyer@example.com" },
  products: [{ productId: "p1", name: "Item", quantity: 2 }],
  timeline: [],
};

function finalizeModule(db) {
  return loader({
    "@/lib/server/firebase-admin": { getAdminDb: () => db },
  })("@/lib/server/finalize-payment");
}

const paidPayment = (amount) => ({
  status: "paid",
  gateway: "paystack",
  reference: "SBFEE_TEST_1",
  amount,
  currency: "NGN",
  customerEmail: "buyer@example.com",
  paidAt: new Date("2025-01-01T10:00:00Z"),
});

test("commitment fee finalizes without marking the order fully paid", async () => {
  const { db, records } = database({
    ...PRODUCTS,
    "orders/o1": { ...COD_ORDER },
  });
  const { finalizeCodCommitmentFee } = finalizeModule(db);

  const result = await finalizeCodCommitmentFee({
    orderId: "o1",
    payment: paidPayment(2500),
    paymentDocId: "pay1",
  });

  assert.equal(result.ok, true);
  const order = records.get("orders/o1");
  assert.equal(order.commitmentFeeStatus, "paid");
  assert.equal(order.paymentStatus, "pending"); // balance due on delivery
  assert.equal(order.codAmountPaid, 2500);
  assert.equal(order.codBalance, 7500);
  assert.equal(order.paymentGateway, "paystack");
  assert.equal(order.inventoryReserved, true);

  const product = records.get("products/p1");
  assert.equal(product.stock, 8);
  assert.equal(product.salesCount, 2);

  const payment = records.get("payments/pay1");
  assert.equal(payment.status, "paid");
  assert.equal(payment.purpose, COD_FEE_PURPOSE);
  assert.equal(payment.amount, 2500);
});

test("commitment fee verification rejects amount mismatch", async () => {
  const { db, records } = database({
    ...structuredClone(PRODUCTS),
    "orders/o1": { ...COD_ORDER },
  });
  const { finalizeCodCommitmentFee } = finalizeModule(db);

  const result = await finalizeCodCommitmentFee({
    orderId: "o1",
    payment: paidPayment(2000), // underpaid
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, "amount_mismatch");
  assert.equal(records.get("orders/o1").commitmentFeeStatus, "processing");
  assert.equal(records.get("products/p1").stock, 10); // untouched
});

test("commitment fee finalization is idempotent", async () => {
  const { db, records } = database({
    ...structuredClone(PRODUCTS),
    "orders/o1": { ...COD_ORDER },
  });
  const { finalizeCodCommitmentFee } = finalizeModule(db);

  const first = await finalizeCodCommitmentFee({
    orderId: "o1",
    payment: paidPayment(2500),
    paymentDocId: "pay1",
    eventId: "evt-1",
  });
  const second = await finalizeCodCommitmentFee({
    orderId: "o1",
    payment: paidPayment(2500),
    paymentDocId: "pay1",
    eventId: "evt-1",
  });
  const third = await finalizeCodCommitmentFee({
    orderId: "o1",
    payment: paidPayment(2500),
    paymentDocId: "pay1",
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.alreadyProcessed, true);
  assert.equal(third.ok, true);
  assert.equal(third.alreadyProcessed, true);
  assert.equal(records.get("products/p1").stock, 8); // decremented once
});

test("commitment fee rejects non-COD orders", async () => {
  const { db } = database({
    ...structuredClone(PRODUCTS),
    "orders/o1": { ...COD_ORDER, paymentMethod: "paystack" },
  });
  const { finalizeCodCommitmentFee } = finalizeModule(db);

  const result = await finalizeCodCommitmentFee({
    orderId: "o1",
    payment: paidPayment(2500),
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid_method");
});

test("COD confirm is blocked while a required fee is unpaid", async () => {
  const { db } = database({
    ...structuredClone(PRODUCTS),
    "orders/o1": { ...COD_ORDER, commitmentFeeStatus: "pending" },
  });
  const { finalizeCashOnDelivery } = finalizeModule(db);

  const result = await finalizeCashOnDelivery("o1");
  assert.equal(result.ok, false);
  assert.equal(result.code, "commitment_fee_required");
});

test("legacy COD orders without fee fields still confirm", async () => {
  const legacy = { ...COD_ORDER };
  delete legacy.codCommitmentFee;
  delete legacy.commitmentFeeStatus;
  const { db, records } = database({
    ...structuredClone(PRODUCTS),
    "orders/o1": legacy,
  });
  const { finalizeCashOnDelivery } = finalizeModule(db);

  const result = await finalizeCashOnDelivery("o1");
  assert.equal(result.ok, true);
  assert.equal(records.get("orders/o1").inventoryReserved, true);
  assert.equal(records.get("products/p1").stock, 8);
});

test("COD shared stock aggregates duplicate product lines and completes all reads before writes", async () => {
  const { db, records } = database({
    ...PRODUCTS,
    "products/p2": { stock: 4, salesCount: 0 },
    "orders/duplicates": {
      ...COD_ORDER,
      commitmentFeeStatus: "paid",
      products: [
        { productId: "p1", quantity: 2 },
        { productId: "p1", quantity: 3 },
        { productId: "p2", quantity: 1 },
      ],
      total: 10000,
    },
  });
  const load = loader({
    "@/lib/server/firebase-admin": { getAdminDb: () => db },
    "firebase-admin/firestore": {
      FieldValue: { serverTimestamp: () => "now" },
    },
  });
  const result = await load(
    "@/lib/server/finalize-payment",
  ).finalizeCashOnDelivery("duplicates");
  assert.equal(result.ok, true);
  assert.equal(records.get("products/p1").stock, 5);
  assert.equal(records.get("products/p2").stock, 3);
});
