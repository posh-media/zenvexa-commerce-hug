const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { loader, database } = require("./payment-test-helpers.cjs");
const adminFields = {
  FieldValue: { serverTimestamp: () => new Date("2026-10-28T12:00:00Z") },
};
function storeEnv(id) {
  process.env.NEXT_PUBLIC_STORE_ID = id;
  process.env.STORE_ID = id;
  delete process.env.NEXT_PUBLIC_SHOPBETA_SETTINGS_CUTOVER;
}
function harness(initial = {}) {
  const f = database(initial);
  const load = loader(
    {
      "@/lib/server/firebase-admin": {
        getAdminDb: () => f.db,
        isFirebaseAdminConfigured: () => true,
      },
      "firebase-admin/firestore": adminFields,
    },
    { realMiddleware: true },
  );
  return { ...f, load };
}
test("prefix handles spaces, camel case, acronyms, punctuation, Unicode and short names", () => {
  const { orderPrefix } = loader()("@/lib/store");
  for (const [name, prefix] of [
    ["Shop Beta", "SB"],
    [" ShopBeta ", "SB"],
    ["Zenvexa", "ZEN"],
    ["APIStore", "AS"],
    ["shop-beta", "SB"],
    ["X", "X"],
    ["123 Mart", "1M"],
    ["Élan", "ÉLA"],
  ])
    assert.equal(orderPrefix(name), prefix, name);
  assert.throws(() => orderPrefix("  -- "));
});
test("legacy attribution fails closed on unknown names and fixed IDs survive display rename", () => {
  const { recordStoreId } = loader()("@/lib/store");
  for (const data of [
    {},
    { storeId: null },
    { storeName: "  " },
    { storeId: "", storeName: null },
  ])
    assert.equal(recordStoreId(data), "shopbeta");
  assert.equal(recordStoreId({ storeName: "Shop Beta" }), "shopbeta");
  assert.equal(
    recordStoreId({ storeId: "zenvexa", storeName: "Our New Brand" }),
    "zenvexa",
  );
  assert.equal(recordStoreId({ storeName: "unidentified" }), null);
  assert.equal(recordStoreId({ storeId: "typo" }), null);
  assert.equal(recordStoreId({ store: "Zenvexa" }), "zenvexa");
});
test("settings paths and mandatory identity never fall back to the other store", () => {
  const lib = loader()("@/lib/store");
  storeEnv("zenvexa");
  assert.equal(lib.settingsDocumentId(), "Zenvexa");
  assert.throws(
    () => lib.requireStoreName(undefined),
    /Admin has not configured/,
  );
  assert.throws(
    () => lib.requireStoreName({ storeInformation: { name: "   " } }),
    /Admin has not configured/,
  );
  assert.throws(
    () =>
      lib.requireStoreName({
        storeId: "shopbeta",
        storeInformation: { name: "ShopBeta" },
      }),
    /mismatch/,
  );
  storeEnv("shopbeta");
  assert.equal(lib.settingsDocumentId(), "app");
  process.env.NEXT_PUBLIC_SHOPBETA_SETTINGS_CUTOVER = "true";
  assert.equal(lib.settingsDocumentId(), "ShopBeta");
  process.env.STORE_ID = "zenvexa";
  assert.throws(lib.deploymentStoreId, /disagree/);
  storeEnv("zenvexa");
});
test("store credentials and async contexts remain separate under concurrent requests", async () => {
  storeEnv("zenvexa");
  process.env.PAYSTACK_SECRET_KEY = "deployment-only";
  const f = harness({
    "privatePaymentSettings/paystack": { secretKey: "old-shopbeta" },
    "privatePaymentSettings/zenvexa/providers/paystack": {
      secretKey: "zen-current",
    },
  });
  const ctx = f.load("@/lib/server/store-context");
  const values = await Promise.all(
    ["shopbeta", "zenvexa"].map((id) =>
      ctx.withStoreContext({ id }, async () => {
        await new Promise((r) => setTimeout(r, id === "shopbeta" ? 10 : 1));
        return [
          (await ctx.providerSecrets("paystack")).secretKey,
          ctx.deploymentEnv("PAYSTACK_SECRET_KEY"),
        ];
      }),
    ),
  );
  assert.deepEqual(values, [
    ["old-shopbeta", undefined],
    ["zen-current", "deployment-only"],
  ]);
  f.records.delete("privatePaymentSettings/zenvexa/providers/paystack");
  assert.deepEqual(await ctx.providerSecrets("paystack"), {});
  delete process.env.PAYSTACK_SECRET_KEY;
});
test("credential rotation retains an immutable private account version for an existing attempt", async () => {
  storeEnv("zenvexa");
  const f = harness({
    "privatePaymentSettings/zenvexa/providers/squad": {
      sandboxSecretKey: "original-account",
    },
  });
  const ctx = f.load("@/lib/server/store-context");
  const version = await f
    .load("@/lib/server/store-request")
    .captureProviderVersion("squad");
  f.records.set("privatePaymentSettings/zenvexa/providers/squad", {
    sandboxSecretKey: "replacement-account",
  });
  const saved = await ctx.withStoreContext(
    { id: "zenvexa", credentialVersion: version },
    () => ctx.providerSecrets("squad"),
  );
  assert.equal(saved.sandboxSecretKey, "original-account");
  assert.equal(
    (await ctx.providerSecrets("squad")).sandboxSecretKey,
    "replacement-account",
  );
  await assert.rejects(
    ctx.withStoreContext({ id: "zenvexa", credentialVersion: "missing" }, () =>
      ctx.providerSecrets("squad"),
    ),
    /unavailable/,
  );
});
test("request boundary rejects foreign orders and owner mismatches before provider actions", async () => {
  storeEnv("zenvexa");
  const f = database({
    "orders/sb": { userId: "owner", storeId: "shopbeta" },
    "orders/zen": { userId: "owner", storeId: "zenvexa" },
    "users/owner": { role: "customer" },
  });
  let actions = 0;
  const load = loader(
    {
      "@/lib/server/firebase-admin": {
        getAdminDb: () => f.db,
        getAdminApp: () => ({}),
      },
      "firebase-admin/auth": {
        getAuth: () => ({ verifyIdToken: async (token) => ({ uid: token }) }),
      },
    },
    { realMiddleware: true },
  );
  const route = load("@/lib/server/store-request").withStoreRequest;
  const req = (orderId, token) =>
    new Request("https://zenvexacommerce.com/api/payments/squad/initialize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId, storeId: "zenvexa" }),
    });
  const action = async () => {
    actions++;
    return new Response("ok");
  };
  assert.equal((await route(req("sb", "owner"), action)).status, 404);
  assert.equal((await route(req("zen", "intruder"), action)).status, 403);
  assert.equal((await route(req("zen", "owner"), action)).status, 200);
  assert.equal(actions, 1);
});
test("shared webhook selects saved store and credential version, not the receiving deployment or payload store", async () => {
  storeEnv("zenvexa");
  const f = harness({
    "orders/sb": { storeId: "shopbeta", userId: "owner" },
    "payments/p": {
      gateway: "squad",
      reference: "ref",
      orderId: "sb",
      storeId: "shopbeta",
      credentialVersion: "version-1",
    },
    "privatePaymentSettings/shopbeta/providers/squad/versions/version-1": {
      sandboxSecretKey: "saved-account",
    },
  });
  const ctx = f.load("@/lib/server/store-context");
  const guard = f.load("@/lib/server/store-request");
  const handler = async (request) =>
    guard.withStoreRequest(
      request,
      async () => {
        const data = await ctx.providerSecrets("squad");
        const raw = await request.text();
        const expected = createHmac("sha512", data.sandboxSecretKey)
          .update(raw)
          .digest("hex");
        return new Response(ctx.currentStoreId(), {
          status:
            expected === request.headers.get("x-squad-encrypted-body")
              ? 200
              : 401,
        });
      },
      { webhook: "squad" },
    );
  const raw = JSON.stringify({ TransactionRef: "ref", storeId: "zenvexa" });
  for (const [key, status] of [
    ["receiving-deployment-key", 401],
    ["saved-account", 200],
  ]) {
    const response = await handler(
      new Request("https://zenvexacommerce.com/api/payments/squad/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-squad-encrypted-body": createHmac("sha512", key)
            .update(raw)
            .digest("hex"),
        },
        body: raw,
      }),
    );
    assert.equal(response.status, status);
    if (status === 200) assert.equal(await response.text(), "shopbeta");
  }
});
test("migration cutoff is exclusive, unknown dates/stores are reported and explicit Zenvexa is preserved", async () => {
  const { orderPatch } = await import("../scripts/store-migration-plan.mjs");
  assert.deepEqual(
    orderPatch({ createdAt: "2026-10-27T23:59:59.999Z" }).patch,
    { storeId: "shopbeta", storeName: "ShopBeta" },
  );
  assert.equal(
    orderPatch({ createdAt: "2026-10-28T00:00:00Z" }).reason,
    "after-cutoff",
  );
  assert.equal(orderPatch({ createdAt: null }).reason, "ambiguous-date");
  assert.equal(
    orderPatch({ storeName: "unknown", createdAt: "2020-01-01" }).reason,
    "ambiguous",
  );
  assert.equal(
    orderPatch({
      storeId: "zenvexa",
      storeName: "Zenvexa",
      createdAt: "2020-01-01",
    }).reason,
    "explicit",
  );
  const once = orderPatch({
    createdAt: { seconds: 100, nanoseconds: 0 },
  }).patch;
  assert.equal(
    orderPatch({ ...once, createdAt: { seconds: 100 } }).reason,
    "explicit",
  );
});
test("analytics IDs separate matching paths and dates across stores", () => {
  const { scopedCounterId } = loader()("@/lib/store");
  assert.notEqual(
    scopedCounterId("/", "shopbeta"),
    scopedCounterId("/", "zenvexa"),
  );
  assert.notEqual(
    scopedCounterId("2026-10-28", "shopbeta"),
    scopedCounterId("2026-10-28", "zenvexa"),
  );
});
test("server order creation stamps the deployment identity and recalculates prices from shared catalog", async () => {
  storeEnv("zenvexa");
  const f = database({
    "products/p1": {
      price: 100,
      stock: 10,
      productName: "Real product",
      active: true,
    },
  });
  const load = loader(
    {
      "@/lib/server/firebase-admin": { getAdminDb: () => f.db },
      "firebase-admin/firestore": adminFields,
      "@/services/settings.service": {
        getAppSettings: async () => ({
          storeId: "zenvexa",
          storeInformation: { name: "Zenvexa" },
          taxRate: 0.1,
        }),
      },
    },
    { realMiddleware: true },
  );
  const input = {
    userId: "owner",
    customer: {
      name: "Buyer",
      email: "buyer@example.com",
      phone: "08012345678",
    },
    lines: [
      {
        productId: "p1",
        name: "Test",
        quantity: 2,
        price: 1,
        stock: 10,
        slug: "p1",
      },
    ],
    shippingAddress: {
      fullName: "Buyer",
      phone: "08012345678",
      line1: "Test address",
      city: "Test city",
      country: "Nigeria",
    },
    deliveryOptionId: "standard",
    paymentMethod: "squad",
    total: 220,
    storeId: "shopbeta",
    storeName: "Forged name",
  };
  const result = await load(
    "@/lib/server/create-order",
  ).createPendingOrderServer(input);
  assert.equal(result.ok, true);
  assert.equal(result.order.storeId, "zenvexa");
  assert.equal(result.order.storeName, "Zenvexa");
  assert.match(result.order.orderNumber, /^ZEN-/);
  assert.equal(result.order.subtotal, 200);
  assert.equal(result.order.tax, 20);
  assert.equal(f.records.get("products/p1").stock, 10);
  const bad = await load("@/lib/server/create-order").createPendingOrderServer({
    ...input,
    total: 1,
  });
  assert.equal(bad.ok, false);
  const rows = [...f.records.keys()].filter((k) => k.startsWith("orders/"));
  assert.equal(rows.length, 1);
  f.records.set("coupons/sb", {
    storeId: "shopbeta",
    code: "OFFER",
    discountType: "percentage",
    discountValue: 50,
    active: true,
  });
  f.records.set("coupons/zen", {
    storeId: "zenvexa",
    code: "OFFER",
    discountType: "percentage",
    discountValue: 10,
    active: true,
  });
  const coupon = await load(
    "@/lib/server/create-order",
  ).createPendingOrderServer({ ...input, couponCode: "OFFER", total: 198 });
  assert.equal(coupon.ok, true);
  assert.equal(coupon.order.discount, 20);
  const tooMany = await load(
    "@/lib/server/create-order",
  ).createPendingOrderServer({
    ...input,
    lines: [
      { ...input.lines[0], quantity: 6 },
      { ...input.lines[0], quantity: 6 },
    ],
    total: 1320,
  });
  assert.equal(tooMany.ok, false);
});
test("store filtering precedes paginated lists and total counts, including legacy ShopBeta records", async () => {
  const docs = [
    { id: "zen", data: () => ({ storeId: "zenvexa", orderNumber: "ZEN-1" }) },
    { id: "legacy", data: () => ({ orderNumber: "SB-OLD" }) },
    { id: "sb", data: () => ({ storeId: "shopbeta", orderNumber: "SB-NEW" }) },
    { id: "bad", data: () => ({ storeId: "unknown" }) },
  ];
  const sdk = {
    getDocs: async () => ({ docs }),
    query: (_ref, ...constraints) => ({ constraints }),
    where: (...v) => v,
    orderBy: (...v) => v,
  };
  const load = loader({
    "firebase/firestore": sdk,
    "@/firebase/collections": { ordersCollection: () => ({}) },
  });
  const service = load("@/services/admin-orders.service");
  storeEnv("shopbeta");
  const first = await service.listOrdersAdminPage({ pageSize: 1 });
  assert.equal(first.total, 2);
  assert.equal(first.orders[0].orderNumber, "SB-OLD");
  const next = await service.listOrdersAdminPage({
    pageSize: 1,
    after: first.lastDoc,
  });
  assert.equal(next.orders[0].orderNumber, "SB-NEW");
  assert.equal(next.total, 2);
  storeEnv("zenvexa");
  const zen = await service.listOrdersAdminPage({ pageSize: 1 });
  assert.equal(zen.total, 1);
  assert.equal(zen.orders[0].orderNumber, "ZEN-1");
});
test("shared Cloud Function bridge preserves raw signature bytes and routes from persisted records only", async () => {
  const fs = require("node:fs"),
    path = require("node:path");
  const { db } = database({
    "orders/zen": { storeId: "zenvexa", storeName: "Zenvexa" },
    "payments/p": {
      gateway: "squad",
      reference: "r1",
      orderId: "zen",
      storeId: "zenvexa",
      credentialVersion: "v1",
    },
  });
  const module = { exports: {} };
  new Function(
    "require",
    "module",
    "exports",
    fs.readFileSync(
      path.join(__dirname, "../functions/src/store-routing.js"),
      "utf8",
    ),
  )(
    (name) =>
      name === "firebase-admin/firestore"
        ? { getFirestore: () => db }
        : require(name),
    module,
    module.exports,
  );
  const raw = Buffer.from('{ "TransactionRef": "r1", "storeId":"shopbeta" }');
  let target;
  const original = global.fetch;
  global.fetch = async (url, init) => {
    target = url;
    assert.equal(init.body, raw);
    assert.equal(init.headers["x-squad-encrypted-body"], "original-signature");
    return new Response('{"ok":true}', { status: 200 });
  };
  const result = {
    status(n) {
      this.code = n;
      return this;
    },
    type() {
      return this;
    },
    send(v) {
      this.body = v;
      return this;
    },
    json(v) {
      this.body = v;
      return this;
    },
  };
  try {
    assert.equal(
      await module.exports.routeStoreWebhook(
        {
          method: "POST",
          rawBody: raw,
          headers: { "x-squad-encrypted-body": "original-signature" },
        },
        result,
        "squad",
      ),
      true,
    );
    assert.equal(
      target,
      "https://www.zenvexacommerce.com/api/payments/squad/webhook",
    );
    assert.equal(result.code, 200);
  } finally {
    global.fetch = original;
  }
});
test("ShopBeta keeps legacy settings/credential authority until coordinated cutover; old attempts retain legacy keys afterwards", async () => {
  storeEnv("shopbeta");
  const f = harness({
    "privatePaymentSettings/squad": { sandboxSecretKey: "legacy-latest" },
    "privatePaymentSettings/shopbeta/providers/squad": {
      sandboxSecretKey: "seeded-or-new",
    },
  });
  const lib = f.load("@/lib/store"),
    ctx = f.load("@/lib/server/store-context");
  assert.equal(
    (await ctx.providerSecrets("squad")).sandboxSecretKey,
    "legacy-latest",
  );
  assert.deepEqual(lib.providerDocumentSegments("squad"), [
    "privatePaymentSettings",
    "squad",
  ]);
  process.env.NEXT_PUBLIC_SHOPBETA_SETTINGS_CUTOVER = "true";
  assert.equal(
    (await ctx.providerSecrets("squad")).sandboxSecretKey,
    "seeded-or-new",
  );
  assert.deepEqual(lib.providerDocumentSegments("squad"), [
    "privatePaymentSettings",
    "shopbeta",
    "providers",
    "squad",
  ]);
  assert.equal(
    (
      await ctx.withStoreContext({ id: "shopbeta", legacyAttempt: true }, () =>
        ctx.providerSecrets("squad"),
      )
    ).sandboxSecretKey,
    "legacy-latest",
  );
  storeEnv("zenvexa");
});
test("missing store name blocks initialization before provider or credential-version writes", async () => {
  storeEnv("zenvexa");
  const f = database({
    "orders/zen": {
      storeId: "zenvexa",
      storeName: "Previous name",
      userId: "owner",
    },
    "users/owner": { role: "customer" },
  });
  const load = loader(
    {
      "@/lib/server/firebase-admin": {
        getAdminDb: () => f.db,
        getAdminApp: () => ({}),
      },
      "firebase-admin/auth": {
        getAuth: () => ({ verifyIdToken: async () => ({ uid: "owner" }) }),
      },
      "@/services/settings.service": { getAppSettings: async () => undefined },
    },
    { realMiddleware: true },
  );
  let invoked = false;
  const result = await load("@/lib/server/store-request").withStoreRequest(
    new Request(
      "https://www.zenvexacommerce.com/api/payments/squad/initialize",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer owner",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId: "zen" }),
      },
    ),
    async () => {
      invoked = true;
      return new Response("bad");
    },
    { initialize: true },
  );
  assert.equal(invoked, false);
  assert.match((await result.json()).reason, /Admin has not configured/);
  assert.equal(
    [...f.records.keys()].some((key) => key.includes("/versions/")),
    false,
  );
});
test("parallel guest API calls share one Firebase anonymous sign-in", async () => {
  let currentUser = null,
    signIns = 0;
  const headers = [];
  const original = global.fetch;
  const user = { getIdToken: async () => "test-token" };
  const load = loader({
    "@/firebase/auth": {
      getFirebaseAuth: () => ({
        authStateReady: async () => {},
        get currentUser() {
          return currentUser;
        },
      }),
    },
    "firebase/auth": {
      signInAnonymously: async () => {
        signIns++;
        await new Promise((r) => setTimeout(r, 5));
        currentUser = user;
        return { user };
      },
    },
  });
  global.fetch = async (_url, init) => {
    headers.push(init.headers.Authorization);
    return new Response("{}");
  };
  try {
    await Promise.all([
      load("@/lib/client-api").authenticatedFetch("/one"),
      load("@/lib/client-api").authenticatedFetch("/two"),
    ]);
    assert.equal(signIns, 1);
    assert.deepEqual(headers, ["Bearer test-token", "Bearer test-token"]);
  } finally {
    global.fetch = original;
  }
});
test("Paystack and KoraPay webhook validation awaits account secrets and rejects other-account signatures", async () => {
  const secret = "persisted-test-account";
  const load = loader({
    "@/lib/server/env": {
      getPaystackWebhookSecret: async () => secret,
      getKorapaySecretKey: async () => secret,
    },
  });
  const raw = JSON.stringify({ data: { reference: "TEST", amount: 100 } });
  const paystack = load("@/lib/server/paystack").verifyPaystackWebhookSignature;
  assert.equal(
    await paystack(raw, createHmac("sha512", secret).update(raw).digest("hex")),
    true,
  );
  assert.equal(
    await paystack(
      raw,
      createHmac("sha512", "other-account").update(raw).digest("hex"),
    ),
    false,
  );
  const payload = JSON.parse(raw);
  const korapay = load("@/lib/server/korapay").verifyKorapayWebhookSignature;
  assert.equal(
    await korapay(
      payload,
      createHmac("sha256", secret)
        .update(JSON.stringify(payload.data))
        .digest("hex"),
    ),
    true,
  );
  assert.equal(
    await korapay(
      payload,
      createHmac("sha256", "other-account")
        .update(JSON.stringify(payload.data))
        .digest("hex"),
    ),
    false,
  );
});
test("Firebase Admin refuses a service account from a different client project", () => {
  const previousAccount = process.env.FIREBASE_SERVICE_ACCOUNT,
    previousProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    project_id: "source-project",
  });
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "other-project";
  let initialized = false;
  const load = loader({
    "firebase-admin/app": {
      getApps: () => [],
      cert: () => ({}),
      initializeApp: () => {
        initialized = true;
        return {};
      },
    },
  });
  try {
    assert.throws(
      () => load("@/lib/server/firebase-admin").getAdminApp(),
      /project IDs disagree/,
    );
    assert.equal(initialized, false);
  } finally {
    if (previousAccount === undefined)
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
    else process.env.FIREBASE_SERVICE_ACCOUNT = previousAccount;
    if (previousProject === undefined)
      delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    else process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = previousProject;
  }
});
