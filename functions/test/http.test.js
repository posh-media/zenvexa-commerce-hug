import { test, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { deliveryDefaults, deliveryId } from "../src/core.js";

assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? "", /^(127\.0\.0\.1|localhost):\d+$/);
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "", /^(127\.0\.0\.1|localhost):\d+$/);
const app = initializeApp({ projectId: "zenvexa-c8d84" }, "http-tests");
const db = getFirestore(app);
after(() => deleteApp(app));
const base = "http://127.0.0.1:5001/zenvexa-c8d84/europe-west1";
async function call(name, data, token) {
  const response = await fetch(`${base}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  return { status: response.status, body: await response.json() };
}
test("callable transport enforces identity, denies anonymous staff and keeps gateway disabled", async () => {
  const missing = await call("createOrder", {});
  assert.equal(missing.status, 401);
  const signup = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  assert.equal(signup.status, 200);
  const { idToken } = await signup.json();
  const denied = await call("saveProduct", {}, idToken);
  assert.equal(denied.status, 403);
  assert.equal((await call("createOrder", { total: 1 }, idToken)).status, 400);
  await db.doc("products/http-rice").set({
    active: true,
    stock: 1,
    price: 78500,
    title: "Rice",
    image: "/rice.jpg",
    sku: "HTTP-RICE",
  });
  await db
    .doc(`deliveryZones/${deliveryId("Lagos")}`)
    .set({ ...deliveryDefaults.Lagos, active: true });
  const input = {
    key: "http-1",
    items: [{ productId: "http-rice", quantity: 1 }],
    delivery: {
      recipient: "Sample Buyer",
      phone: "08012345678",
      address: "1 Sample Street",
      landmark: "",
      state: "Lagos",
      zone: "Ikeja",
    },
    paymentMethod: "pod",
    promo: "HUG10",
  };
  assert.equal(
    (await call("createOrder", { ...input, paymentMethod: "card" }, idToken)).status,
    400,
  );
  const created = await call("createOrder", input, idToken);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.equal(created.body.result.total, 72150);
  const repeated = await call("createOrder", input, idToken);
  assert.equal(repeated.body.result.id, created.body.result.id);
  assert.equal((await db.doc("products/http-rice").get()).data().stock, 0);
  const payment = await call("initializePayment", { orderId: created.body.result.id }, idToken);
  assert.equal(payment.status, 400);
  assert.match(payment.body.error.message, /disabled/);
  const webhook = await fetch(`${base}/paystackWebhook`, { method: "POST", body: "{}" });
  assert.equal(webhook.status, 503);
  const email = `staff-${Date.now()}@example.test`;
  const password = "emulator-sample-password";
  const account = await getAuth(app).createUser({ email, password, emailVerified: true });
  const login = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  assert.equal(login.status, 200);
  const staffToken = (await login.json()).idToken;
  const payload = {
    expectedStock: null,
    product: {
      id: "staff-product",
      title: "Staff product",
      category: "Phones & Gadgets",
      price: 1000,
      oldPrice: 1000,
      stock: 1,
      image: "/image.jpg",
      sku: "STAFF-PRODUCT",
      badge: "",
      vendor: "Supplier",
      specs: [],
      description: "Sample product",
    },
  };
  assert.equal((await call("saveProduct", payload, staffToken)).status, 403);
  await db.doc(`staff/${account.uid}`).set({ active: true, role: "inventory" });
  assert.equal((await call("saveProduct", payload, staffToken)).status, 200);
  assert.equal(
    (
      await call(
        "updateOrderStatus",
        { orderId: created.body.result.id, status: "dispatched" },
        staffToken,
      )
    ).status,
    403,
  );
});
