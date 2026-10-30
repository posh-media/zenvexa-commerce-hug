const { test, before, after } = require("node:test");
const { readFileSync } = require("node:fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const { createRequire } = require("node:module");
const { doc, setDoc, updateDoc, getDoc } = createRequire(
  require.resolve("@firebase/rules-unit-testing"),
)("firebase/firestore");
let env;
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Only run this test through the demo Firestore emulator.");
  env = await initializeTestEnvironment({
    projectId: "demo-store-scope",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users/admin"), { role: "admin" });
    await setDoc(doc(db, "users/customer"), { role: "customer" });
    await setDoc(doc(db, "settings/Zenvexa"), {
      storeId: "zenvexa",
      storeInformation: { name: "Zenvexa" },
    });
    await setDoc(doc(db, "settings/ShopBeta"), {
      storeId: "shopbeta",
      storeInformation: { name: "ShopBeta" },
    });
    await setDoc(doc(db, "orders/zen"), {
      storeId: "zenvexa",
      storeName: "Zenvexa",
      userId: "customer",
    });
    await setDoc(doc(db, "orders/legacy"), { userId: "legacy-customer" });
  });
});
after(async () => {
  await env?.cleanup();
});
test("named settings require matching identity, nonblank name and no secrets", async () => {
  const db = env.authenticatedContext("admin").firestore();
  await assertSucceeds(
    updateDoc(doc(db, "settings/Zenvexa"), {
      "storeInformation.name": "Renamed",
    }),
  );
  await assertFails(
    updateDoc(doc(db, "settings/Zenvexa"), { "storeInformation.name": " \t " }),
  );
  await assertFails(
    updateDoc(doc(db, "settings/Zenvexa"), { storeId: "shopbeta" }),
  );
  await assertFails(
    updateDoc(doc(db, "settings/Zenvexa"), {
      paymentSecrets: { secretKey: "forbidden" },
    }),
  );
  await assertFails(
    updateDoc(doc(db, "settings/Zenvexa"), {
      notifications: { makeWebhookUrl: "forbidden" },
    }),
  );
});
test("public settings readable, provider secrets and credential versions never readable by clients", async () => {
  for (const db of [
    env.unauthenticatedContext().firestore(),
    env.authenticatedContext("customer").firestore(),
    env.authenticatedContext("admin").firestore(),
  ]) {
    await assertSucceeds(getDoc(doc(db, "settings/Zenvexa")));
    await assertFails(
      getDoc(doc(db, "privatePaymentSettings/zenvexa/providers/paystack")),
    );
    await assertFails(
      getDoc(
        doc(
          db,
          "privatePaymentSettings/zenvexa/providers/paystack/versions/v1",
        ),
      ),
    );
  }
});
test("only admins may save store credentials and cannot write credential versions", async () => {
  const ref = "privatePaymentSettings/zenvexa/providers/paystack";
  await assertSucceeds(
    setDoc(doc(env.authenticatedContext("admin").firestore(), ref), {
      secretKey: "example",
    }),
  );
  await assertFails(
    setDoc(doc(env.authenticatedContext("customer").firestore(), ref), {
      secretKey: "example",
    }),
  );
  await assertFails(
    setDoc(
      doc(env.authenticatedContext("admin").firestore(), ref + "/versions/v1"),
      { secretKey: "example" },
    ),
  );
});
test("attributable orders must be created by server and cannot be reassigned by client staff", async () => {
  const admin = env.authenticatedContext("admin").firestore(),
    customer = env.authenticatedContext("customer").firestore();
  await assertFails(
    setDoc(doc(customer, "orders/forged"), {
      userId: "customer",
      storeId: "zenvexa",
      storeName: "Zenvexa",
    }),
  );
  await assertFails(
    updateDoc(doc(admin, "orders/zen"), { storeId: "shopbeta" }),
  );
  await assertFails(
    updateDoc(doc(admin, "orders/zen"), { storeName: "Other" }),
  );
  await assertSucceeds(
    updateDoc(doc(admin, "orders/zen"), { orderStatus: "processing" }),
  );
  await assertSucceeds(getDoc(doc(customer, "orders/zen")));
  await assertFails(
    getDoc(doc(env.authenticatedContext("intruder").firestore(), "orders/zen")),
  );
});
test("legacy ShopBeta client order writes remain compatible during rolling deployment", async () => {
  const db = env.authenticatedContext("legacy-customer").firestore();
  await assertSucceeds(
    setDoc(doc(db, "orders/old-writer"), {
      userId: "legacy-customer",
      orderNumber: "SB-LEGACY",
    }),
  );
});
test("new visit counter IDs encode the store and increments cannot transfer attribution", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(
    setDoc(doc(db, "pageVisitDays/zenvexa__2026-10-28"), {
      storeId: "zenvexa",
      date: "2026-10-28",
      count: 1,
    }),
  );
  await assertFails(
    setDoc(doc(db, "pageVisitDays/wrong-id"), {
      storeId: "zenvexa",
      date: "2026-10-28",
      count: 1,
    }),
  );
  await assertFails(
    updateDoc(doc(db, "pageVisitDays/zenvexa__2026-10-28"), {
      storeId: "shopbeta",
      count: 2,
    }),
  );
  await assertSucceeds(
    updateDoc(doc(db, "pageVisitDays/zenvexa__2026-10-28"), { count: 2 }),
  );
  await assertSucceeds(
    setDoc(doc(db, "pageVisitDays/2026-10-28"), {
      date: "2026-10-28",
      count: 1,
    }),
  );
});

test("payment identity and credential versions cannot be reassigned by browser admins", async () => {
  await env.withSecurityRulesDisabled(async (ctx) =>
    setDoc(doc(ctx.firestore(), "payments/pinned"), {
      storeId: "zenvexa",
      storeName: "Zenvexa",
      credentialVersion: "v1",
      orderId: "zen",
      gateway: "squad",
      reference: "ref",
      userId: "customer",
    }),
  );
  const db = env.authenticatedContext("admin").firestore();
  await assertFails(
    updateDoc(doc(db, "payments/pinned"), { storeId: "shopbeta" }),
  );
  await assertFails(
    updateDoc(doc(db, "payments/pinned"), { credentialVersion: "v2" }),
  );
  await assertFails(
    updateDoc(doc(db, "payments/pinned"), { orderId: "legacy" }),
  );
  await assertFails(
    getDoc(doc(db, "storeMigrationReceipts/run/entries/entry")),
  );
});

test("ordinary Google identity cannot bootstrap roles or access admin data", async () => {
  const db = env.authenticatedContext("ordinary-google", { firebase: { sign_in_provider: "google.com" } }).firestore();
  await assertFails(setDoc(doc(db, "users/ordinary-google"), { role: "super_admin" }));
  await assertSucceeds(setDoc(doc(db, "users/ordinary-google"), { role: "customer", status: "active" }));
  await assertFails(updateDoc(doc(db, "users/ordinary-google"), { role: "admin" }));
  await assertFails(getDoc(doc(db, "ads/private")));
});

test("suspended, deleted and inactive administrators cannot use staff permissions or reactivate themselves", async () => {
  for (const [uid, fields] of [["suspended-admin", { status: "suspended" }], ["deleted-admin", { status: "deleted" }], ["inactive-admin", { active: false }]]) {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `users/${uid}`), { role: "admin", ...fields }));
    const db = env.authenticatedContext(uid).firestore();
    await assertFails(getDoc(doc(db, "ads/private")));
    await assertFails(updateDoc(doc(db, `users/${uid}`), { status: "active", active: true }));
  }
});

test("staff roles retain distinct permissions", async () => {
  for (const role of ["super_admin", "admin", "inventory_manager", "order_manager", "customer_support", "marketing_manager", "staff"]) {
    const uid = `role-${role}`;
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `users/${uid}`), { role, status: "active" }));
    const db = env.authenticatedContext(uid).firestore();
    const action = setDoc(doc(db, `products/rbac-${role}`), { name: "Fixture" });
    await (["super_admin", "admin", "inventory_manager"].includes(role) ? assertSucceeds(action) : assertFails(action));
  }
});
