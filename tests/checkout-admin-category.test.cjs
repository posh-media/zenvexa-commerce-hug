const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loader } = require("./payment-test-helpers.cjs");

test("category sections prefer stable IDs, normalize aliases, deduplicate products and retain sort order", () => {
  const { categorySections } = loader()("@/lib/category-sections");
  const categories = [{ id: "phones", name: "Mobile Phones", slug: "mobile-phones" }];
  const products = [
    { id: "1", categoryId: "phones", category: "old name" },
    { id: "2", category: " MOBILE   PHONES " },
    { id: "1", categoryId: "phones" },
    { id: "3", category: "unknown" },
  ];
  const sections = categorySections(products, categories);
  assert.deepEqual(sections.map((s) => s.name), ["Mobile Phones", "Other"]);
  assert.deepEqual(sections[0].items.map((p) => p.id), ["1", "2"]);
  assert.equal(sections.flatMap((s) => s.items).length, 3);
  assert.deepEqual(categorySections([], categories), []);
});

test("ambiguous category names are not guessed", () => {
  const { categorySections } = loader()("@/lib/category-sections");
  const categories = [
    { id: "a", name: "Shared name", slug: "a" },
    { id: "b", name: "Shared name", slug: "b" },
  ];
  assert.equal(categorySections([{ id: "1", category: "Shared name" }], categories)[0].name, "Other");
});

function bootstrapHarness(existing, role = "customer") {
  const writes = [];
  const profile = { exists: !!existing, data: () => ({ role, email: "superadmin@zenvexa.com", status: "active" }) };
  const db = { collection: () => ({
    where: () => ({ get: async () => ({ empty: !existing, docs: existing ? [{ id: "uid" }] : [] }) }),
    doc: () => ({ get: async () => profile, create: async (data) => writes.push(data) }),
  }) };
  const auth = {
    getUserByEmail: async () => { if (existing) return { uid: "uid", disabled: false }; throw Object.assign(new Error(), { code: "auth/user-not-found" }); },
    createUser: async (data) => { writes.push(data); return { uid: "uid" }; },
  };
  return { auth, db, writes };
}

test("super admin bootstrap refuses elevation of an existing ordinary account", async () => {
  const { provisionSuperAdmin } = await import("../scripts/lib/super-admin-bootstrap.mjs");
  const h = bootstrapHarness(true);
  await assert.rejects(provisionSuperAdmin(h.auth, h.db, "superadmin@zenvexa.com"), /conflicts/);
  assert.equal(h.writes.length, 0);
});

test("bootstrap rerun does not reset passwords or update profiles", async () => {
  const { provisionSuperAdmin } = await import("../scripts/lib/super-admin-bootstrap.mjs");
  const h = bootstrapHarness(true, "super_admin");
  assert.deepEqual(await provisionSuperAdmin(h.auth, h.db, "superadmin@zenvexa.com"), { created: false });
  assert.equal(h.writes.length, 0);
});

test("new super admin gets UID profile and undisclosed random password", async () => {
  const { provisionSuperAdmin } = await import("../scripts/lib/super-admin-bootstrap.mjs");
  const h = bootstrapHarness(false);
  assert.deepEqual(await provisionSuperAdmin(h.auth, h.db, "superadmin@zenvexa.com"), { created: true });
  assert.equal(h.writes[0].emailVerified, false);
  assert.ok(h.writes[0].password.length >= 64);
  assert.equal(h.writes[1].role, "super_admin");
});

test("concurrent Make confirmations claim once and carry immutable store context and event identity", async () => {
  let data = { paymentStatus: "paid", storeId: "zenvexa", storeName: "Zenvexa", customer: { email: "fixture@example.test" } };
  const snapshot = () => ({ exists: true, id: "o1", data: () => ({ ...data }) });
  const ref = { get: async () => snapshot(), set: async (patch) => { data = { ...data, ...patch }; } };
  let tail = Promise.resolve();
  const db = { collection: () => ({ doc: () => ref }), runTransaction: (action) => {
    const result = tail.then(() => action({ get: async () => snapshot(), update: (_ref, patch) => { data = { ...data, ...patch }; } }));
    tail = result.catch(() => {});
    return result;
  } };
  const load = loader({
    "@/lib/server/firebase-admin": { getAdminDb: () => db },
    "@/lib/server/store-context": { currentStoreId: () => "zenvexa", privateIntegrationSettings: async () => ({ makeWebhookUrl: "https://example.test/webhook" }), deploymentEnv: () => "" },
    "@/lib/server/env": { getAppUrl: () => "https://example.test" },
    "@/lib/server/payment-log": { paymentLog: () => {} },
    "firebase-admin/firestore": { FieldValue: { serverTimestamp: () => new Date(), delete: () => null } },
  });
  const { notifyMakeOrderPaid } = load("@/lib/server/make-webhook");
  const originalFetch = global.fetch;
  const deliveries = [];
  global.fetch = async (_url, options) => { deliveries.push(options); return { ok: true }; };
  try {
    await Promise.all([1, 2].map(() => notifyMakeOrderPaid({ order: { id: "o1", ...data }, reference: "reference" })));
    assert.equal(deliveries.length, 1);
    const payload = JSON.parse(deliveries[0].body);
    assert.equal(payload.storeId, "zenvexa");
    assert.equal(payload.storeName, "Zenvexa");
    assert.equal(payload.eventId, "zenvexa:o1:payment-confirmed");
    assert.equal(deliveries[0].headers["Idempotency-Key"], payload.eventId);
    assert.equal(data.makeNotifyStatus, "sent");
  } finally { global.fetch = originalFetch; }
});

test("password change reauthenticates before updating and does not update after failed reauthentication", async () => {
  const calls = [];
  let denied = false;
  const user = { email: "fixture@example.test", providerData: [{ providerId: "password" }] };
  const load = loader({
    "firebase/auth": {
      EmailAuthProvider: { credential: () => ({}) },
      reauthenticateWithCredential: async () => { calls.push("reauth"); if (denied) throw Object.assign(new Error(), { code: "auth/invalid-credential" }); },
      updatePassword: async () => calls.push("update"),
    },
    "firebase/firestore": {},
    "@/firebase/auth": { getFirebaseAuth: () => ({ currentUser: user }) },
    "@/services/users.service": {},
  });
  const { changePassword } = load("@/services/auth.service");
  assert.equal((await changePassword("old-fixture", "new-fixture-password")).ok, true);
  assert.deepEqual(calls, ["reauth", "update"]);
  denied = true;
  assert.equal((await changePassword("wrong-fixture", "new-fixture-password")).ok, false);
  assert.deepEqual(calls, ["reauth", "update", "reauth"]);
});

test("legacy shared finalizer reads the private ShopBeta endpoint and suppresses repeat notifications", async () => {
  const { readFileSync } = require("node:fs");
  let data = { paymentStatus: "paid", storeName: "Historical ShopBeta" };
  const ref = { get: async () => ({ exists: true, data: () => ({ ...data }) }), set: async (patch) => { data = { ...data, ...patch }; } };
  const db = {
    doc: (path) => ({ get: async () => ({ data: () => path === "privateStoreSettings/shopbeta" ? { makeWebhookUrl: "https://example.test/private-endpoint" } : {} }) }),
    collection: () => ({ doc: () => ref }),
    runTransaction: async (action) => action({ get: () => ref.get(), update: (_ref, patch) => { data = { ...data, ...patch }; } }),
  };
  const module = { exports: {} };
  const customRequire = (name) => {
    if (name === "firebase-admin/firestore") return { getFirestore: () => db, FieldValue: { serverTimestamp: () => new Date(), delete: () => null } };
    if (name === "./store-routing") return { storeFrom: () => "shopbeta" };
    if (name === "./stripUndefined") return { stripUndefined: (value) => value };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function("require", "module", "exports", readFileSync("functions/src/finalizeShared.js", "utf8"))(customRequire, module, module.exports);
  const originalFetch = global.fetch;
  const deliveries = [];
  global.fetch = async (url, options) => { deliveries.push({ url, ...options }); return { ok: true }; };
  try {
    await module.exports.notifyMake({ id: "legacy-order", ...data }, "ref");
    await module.exports.notifyMake({ id: "legacy-order", ...data }, "ref");
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].url, "https://example.test/private-endpoint");
    const payload = JSON.parse(deliveries[0].body);
    assert.equal(payload.storeId, "shopbeta");
    assert.equal(payload.storeName, "Historical ShopBeta");
    assert.equal(payload.eventId, "shopbeta:legacy-order:payment-confirmed");
  } finally { global.fetch = originalFetch; }
});
