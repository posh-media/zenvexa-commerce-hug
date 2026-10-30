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
