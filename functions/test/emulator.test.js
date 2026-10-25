import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { commerceService } from "../src/commerce-service.js";
import { adminService } from "../src/admin-service.js";
import { deliveryDefaults, deliveryId } from "../src/core.js";

assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? "", /^(127\.0\.0\.1|localhost):\d+$/);
const projectId = "zenvexa-c8d84";
let env, app, db, service;
const product = {
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
  rating: 0,
  reviews: 0,
};
const request = (key, method = "card") => ({
  key,
  items: [{ productId: "rice", quantity: 1 }],
  delivery: {
    recipient: "Sample Buyer",
    phone: "08012345678",
    address: "1 Sample Street",
    landmark: "",
    state: "Lagos",
    zone: "Ikeja",
  },
  paymentMethod: method,
  promo: "",
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") },
    storage: { rules: await readFile(new URL("../../storage.rules", import.meta.url), "utf8") },
  });
  app = initializeApp({ projectId }, "tests");
  db = getFirestore(app);
  service = commerceService(db);
});
after(async () => {
  await env?.cleanup();
  if (app) await deleteApp(app);
});
async function reset(stock = 2) {
  await env.clearFirestore();
  await db.doc("products/rice").set({ ...product, stock });
  await db
    .doc(`deliveryZones/${deliveryId("Lagos")}`)
    .set({ ...deliveryDefaults.Lagos, active: true });
  await db.doc("staff/admin").set({ active: true, role: "admin" });
}
test("rules isolate customers and deny client price, inventory, order, role, settings and payment writes", async () => {
  await reset();
  await db.doc("orders/private").set({ userId: "alice", status: "pending_payment" });
  const alice = env.authenticatedContext("alice").firestore();
  const bob = env.authenticatedContext("bob").firestore();
  const anon = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(alice, "orders/private")));
  await assertFails(getDoc(doc(bob, "orders/private")));
  await assertFails(getDoc(doc(anon, "orders/private")));
  await assertSucceeds(getDoc(doc(anon, "products/rice")));
  for (const path of [
    "products/rice",
    "orders/forged",
    "staff/alice",
    "paymentAttempts/forged",
    "settings/app",
    "inventoryEvents/forged",
  ])
    await assertFails(
      setDoc(doc(alice, path), { role: "admin", stock: 999, paymentStatus: "paid" }),
    );
  await assertFails(updateDoc(doc(alice, "products/rice"), { stock: 0 }));
  await assertFails(
    setDoc(doc(alice, "profiles/alice"), { displayName: "Buyer", phone: "", role: "admin" }),
  );
  await assertSucceeds(setDoc(doc(alice, "profiles/alice"), { displayName: "Buyer", phone: "" }));
  await assertFails(getDoc(doc(bob, "profiles/alice")));
  await assertSucceeds(
    setDoc(doc(alice, "profiles/alice/addresses/home"), request("address").delivery),
  );
  await assertFails(getDoc(doc(bob, "profiles/alice/addresses/home")));
});
test("staff claims alone do not grant permissions; product uploads require verified staff and safe type", async () => {
  await reset();
  const forged = env.authenticatedContext("buyer", { role: "admin", email_verified: true });
  await assertFails(getDoc(doc(forged.firestore(), "auditLogs/private")));
  await assertFails(
    uploadBytes(ref(forged.storage(), "products/rice/test.png"), new Uint8Array([1]), {
      contentType: "image/png",
    }),
  );
  const admin = env.authenticatedContext("admin", { email_verified: true });
  await assertFails(setDoc(doc(admin.firestore(), "products/rice"), product));
  await assertSucceeds(
    uploadBytes(ref(admin.storage(), "products/rice/test.png"), new Uint8Array([1]), {
      contentType: "image/png",
    }),
  );
  await assertFails(
    uploadBytes(ref(admin.storage(), "products/rice/test.svg"), new Uint8Array([1]), {
      contentType: "image/svg+xml",
    }),
  );
  await assertFails(
    uploadBytes(ref(admin.storage(), "private/test.png"), new Uint8Array([1]), {
      contentType: "image/png",
    }),
  );
});
test("same request concurrently creates one order and one inventory deduction; changed payload rejected", async () => {
  await reset();
  const orders = await Promise.all([
    service.createOrder("buyer", request("same")),
    service.createOrder("buyer", request("same")),
  ]);
  assert.equal(orders[0].id, orders[1].id);
  assert.equal((await db.doc("products/rice").get()).data().stock, 1);
  assert.equal((await db.collection("inventoryEvents").get()).size, 1);
  await assert.rejects(service.createOrder("buyer", { ...request("same"), promo: "HUG10" }));
});
test("concurrent customers cannot oversell last unit", async () => {
  await reset(1);
  const results = await Promise.allSettled([
    service.createOrder("a", request("a")),
    service.createOrder("b", request("b")),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await db.doc("products/rice").get()).data().stock, 0);
});
test("unauthorized admin denied and stale inventory edits cannot overwrite reservations", async () => {
  await reset();
  await assert.rejects(service.saveProduct("buyer", { product, expectedStock: 2 }));
  await service.createOrder("buyer", request("reserve"));
  await assert.rejects(service.saveProduct("admin", { product, expectedStock: 2 }));
  await service.saveProduct("admin", {
    product: { ...product, stock: 3 },
    expectedStock: 1,
    reason: "Fixture stock receipt",
  });
  assert.equal((await db.doc("products/rice").get()).data().stock, 3);
});
test("POD delivery is not paid; collection requires admin and cancellation releases once", async () => {
  await reset();
  const order = await service.createOrder("buyer", request("pod", "pod"));
  await assert.rejects(service.transition("buyer", { orderId: order.id, status: "dispatched" }));
  await service.transition("admin", { orderId: order.id, status: "dispatched" });
  await service.transition("admin", { orderId: order.id, status: "delivered" });
  assert.equal((await db.doc(`orders/${order.id}`).get()).data().paymentStatus, "uncollected");
  await service.collectPod("admin", { orderId: order.id, receipt: "sample-receipt" });
  assert.equal((await db.doc(`orders/${order.id}`).get()).data().paymentStatus, "collected");
  const second = await service.createOrder("buyer", request("cancel", "pod"));
  await service.transition("admin", { orderId: second.id, status: "cancelled" });
  await service.transition("admin", { orderId: second.id, status: "cancelled" });
  assert.equal((await db.doc("products/rice").get()).data().stock, 1);
});
test("pending/failed/success/replayed verification and refund preserve inventory and ownership", async () => {
  await reset();
  const order = await service.createOrder("buyer", request("payment"));
  await assert.rejects(service.preparePayment("other", order.id, "buyer@example.test"));
  const attempt = await service.preparePayment("buyer", order.id, "buyer@example.test");
  const payment = {
    reference: attempt.reference,
    amount: attempt.amountKobo,
    currency: "NGN",
    status: "pending",
    customer: { email: attempt.email },
    metadata: { orderId: order.id, userId: "buyer" },
  };
  for (const status of ["pending", "failed", "abandoned"])
    assert.equal(
      (await service.applyPayment(attempt.reference, { ...payment, status })).status,
      status,
    );
  await assert.rejects(
    service.applyPayment(attempt.reference, { ...payment, amount: 1, status: "success" }),
  );
  await service.applyPayment(attempt.reference, { ...payment, status: "success" });
  await service.applyPayment(attempt.reference, { ...payment, status: "success" });
  await service.applyPayment(attempt.reference, { ...payment, status: "failed" });
  assert.equal((await db.doc(`orders/${order.id}`).get()).data().paymentStatus, "paid");
  assert.equal((await db.doc("products/rice").get()).data().stock, 1);
  await assert.rejects(
    service.applyRefund(attempt.reference, {
      status: "processed",
      amount: 1,
      currency: "NGN",
      transaction: { reference: attempt.reference },
    }),
  );
  const refund = {
    status: "processed",
    amount: attempt.amountKobo,
    currency: "NGN",
    transaction: { reference: attempt.reference },
  };
  await service.applyRefund(attempt.reference, refund);
  await service.applyRefund(attempt.reference, refund);
  assert.equal((await db.doc(`orders/${order.id}`).get()).data().status, "refunded");
  assert.equal((await db.doc("products/rice").get()).data().stock, 1);
});
test("admin reads enforce section permissions, pagination and safe payment projection", async () => {
  await reset();
  const admin = adminService(db);
  await db.doc("staff/inventory").set({ active: true, role: "inventory" });
  await db.doc("products/second").set({ ...product, id: "second", sku: "SECOND" });
  await db.doc("paymentAttempts/ref").set({
    reference: "ref",
    orderId: "order",
    amountKobo: 100,
    currency: "NGN",
    status: "pending",
    secret: "synthetic-private-field",
    email: "fixture@example.test",
  });
  await assert.rejects(admin.read("buyer", { section: "products" }));
  await assert.rejects(admin.read("inventory", { section: "payments" }));
  const first = await admin.read("inventory", { section: "products", limit: 1 });
  assert.equal(first.records.length, 1);
  assert.ok(first.nextCursor);
  const second = await admin.read("inventory", {
    section: "products",
    limit: 1,
    cursor: first.nextCursor,
  });
  assert.notEqual(first.records[0].id, second.records[0].id);
  const payments = await admin.read("admin", { section: "payments" });
  assert.equal(payments.records[0].provider, "paystack");
  assert.equal(payments.records[0].secret, undefined);
  assert.equal(payments.records[0].email, undefined);
});
test("inventory adjustments reject stale stock and record authorized reasons", async () => {
  await reset();
  const admin = adminService(db);
  await service.createOrder("buyer", request("admin-reservation", "pod"));
  const adjustment = {
    productId: "rice",
    delta: 2,
    expectedStock: 2,
    reason: "Fixture delivery received",
  };
  await assert.rejects(admin.adjustInventory("admin", adjustment));
  await assert.rejects(admin.adjustInventory("buyer", { ...adjustment, expectedStock: 1 }));
  await admin.adjustInventory("admin", { ...adjustment, expectedStock: 1 });
  assert.equal((await db.doc("products/rice").get()).data().stock, 3);
  assert.equal(
    (await db.collection("auditLogs").where("action", "==", "inventory.adjust").get()).size,
    1,
  );
});
test("dashboard revenue excludes unpaid, test and unknown-provenance orders", async () => {
  await reset();
  const admin = adminService(db);
  const base = {
    status: "delivered",
    paymentStatus: "paid",
    source: "checkout",
    isTest: false,
    createdAt: new Date(),
  };
  for (const [key, data] of Object.entries({
    paid: { ...base, total: 100 },
    collected: { ...base, paymentStatus: "collected", total: 50 },
    unpaid: { ...base, paymentStatus: "pending", total: 9999 },
    test: { ...base, isTest: true, total: 9999 },
    legacy: { total: 9999, paymentStatus: "paid", status: "delivered", createdAt: new Date() },
  }))
    await db.doc(`orders/${key}`).set(data);
  const overview = await admin.dashboard("admin");
  assert.equal(overview.revenue, 150);
  assert.equal(overview.orders, 5);
});
test("configuration preserves canonical categories and ETA while checkout uses approved fees", async () => {
  await reset();
  const admin = adminService(db);
  await assert.rejects(
    admin.saveConfiguration("admin", {
      section: "categories",
      record: { name: "All Merchandise" },
    }),
  );
  await assert.rejects(
    admin.saveConfiguration("buyer", {
      section: "settings",
      record: { email: "store@example.test" },
    }),
  );
  const record = {
    state: "Lagos",
    ...deliveryDefaults.Lagos,
    fee: 1600,
    reason: "Fixture fee update",
  };
  await assert.rejects(
    admin.saveConfiguration("admin", { section: "delivery", record: { ...record, eta: "today" } }),
  );
  await admin.saveConfiguration("admin", { section: "delivery", record });
  const order = await service.createOrder("buyer", request("updated-fee", "pod"));
  assert.equal(order.total, product.price + 1600);
});
