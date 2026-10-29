process.env.NEXT_PUBLIC_STORE_ID = "shopbeta";
process.env.STORE_ID = "shopbeta";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");

// Run the actual TypeScript modules with mocked network/database boundaries.
function loader(overrides = {}) {
  overrides = {
    "@/lib/server/store-request": {
      withStoreRequest: async (_req, fn) => fn(),
    },
    ...overrides,
  };
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (!name.startsWith("@/")) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    let file = path.join(__dirname, "../src", name.slice(2) + ".ts");
    if (!fs.existsSync(file))
      file = path.join(__dirname, "../src", name.slice(2), "index.ts");
    const module = { exports: {} };
    cache.set(name, module);
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    new Function("require", "module", "exports", output)(
      (specifier) =>
        load(
          specifier.startsWith(".")
            ? "@/" +
                path.posix.normalize(
                  path.posix.join(
                    path
                      .relative(
                        path.join(__dirname, "../src"),
                        path.dirname(file),
                      )
                      .split(path.sep)
                      .join("/"),
                    specifier,
                  ),
                )
            : specifier,
        ),
      module,
      module.exports,
    );
    return module.exports;
  }
  return load;
}

function database(initial) {
  const records = new Map(
    Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]),
  );
  let next = 0;
  const snap = (ref) => ({
    id: ref.id,
    ref,
    exists: records.has(ref.path),
    data: () => records.get(ref.path),
  });
  const ref = (collection, id) => ({
    id,
    path: `${collection}/${id}`,
    collection: (name) => query(`${collection}/${id}/${name}`),
    create: async function (value) {
      if (records.has(this.path)) throw new Error("exists");
      records.set(this.path, value);
    },
    set: async function (value, options) {
      records.set(
        this.path,
        options?.merge ? { ...records.get(this.path), ...value } : value,
      );
    },
    get: async function () {
      return snap(this);
    },
    update: async function (patch) {
      records.set(this.path, { ...records.get(this.path), ...patch });
    },
  });
  function query(collection, filters = [], count = Infinity) {
    return {
      doc: (id) => ref(collection, id || `payment-${++next}`),
      where: (field, op, value) =>
        query(collection, [...filters, [field, value]], count),
      limit: (n) => query(collection, filters, n),
      get: async () => {
        const docs = [...records]
          .filter(
            ([k, v]) =>
              k.startsWith(`${collection}/`) &&
              k.split("/").length === collection.split("/").length + 1 &&
              filters.every(([field, value]) => v[field] === value),
          )
          .slice(0, count)
          .map(([key]) => snap(ref(collection, key.split("/").at(-1))));
        return { docs, empty: docs.length === 0 };
      },
    };
  }
  const db = {
    collection: query,
    runTransaction: async (fn) => {
      const writes = [];
      const result = await fn({
        get: async (r) => {
          assert.equal(writes.length, 0, "Firestore reads must precede writes");
          return snap(r);
        },
        set: (r, value, options) =>
          writes.push(() =>
            records.set(
              r.path,
              options?.merge ? { ...records.get(r.path), ...value } : value,
            ),
          ),
        update: (r, value) =>
          writes.push(() =>
            records.set(r.path, { ...records.get(r.path), ...value }),
          ),
      });
      writes.forEach((write) => write());
      return result;
    },
  };
  return { db, records };
}

function fixture({ enabled = true, method = "squad" } = {}) {
  const reference = `SQ${"a".repeat(32)}`;
  const { db, records } = database({
    "settings/app": { payments: { squadEnabled: enabled, squadSandbox: true } },
    "privatePaymentSettings/squad": {
      sandboxSecretKey: "sandbox-secret",
      liveSecretKey: "live-secret",
    },
    "orders/order-1": {
      orderNumber: "SB-1",
      userId: "customer-1",
      paymentMethod: method,
      paymentStatus: "pending",
      total: 100,
      customer: { email: "customer@example.com", name: "Customer" },
      products: [{ productId: "product-1", quantity: 2 }],
      paymentReference: reference,
    },
    "products/product-1": { stock: 10, salesCount: 0, active: true },
    "payments/attempt-1": {
      orderId: "order-1",
      userId: "customer-1",
      reference,
      gateway: "squad",
      amount: 100,
      metadata: { sandbox: true },
    },
  });
  let notifications = 0;
  const load = loader({
    "@/lib/server/firebase-admin": {
      getAdminDb: () => db,
      isFirebaseAdminConfigured: () => true,
    },
    "@/lib/server/env": {
      getAppUrl: () => "https://shopbeta.example",
      toKobo: (n) => Math.round(n * 100),
    },
    "@/lib/server/make-webhook": {
      notifyMakeOrderPaid: async () => {
        notifications++;
        return { ok: true };
      },
    },
  });
  const verified = {
    transaction_amount: 10000,
    transaction_ref: reference,
    transaction_status: "Success",
    transaction_currency_id: "NGN",
    email: "customer@example.com",
  };
  return {
    load,
    records,
    reference,
    verified,
    notifications: () => notifications,
  };
}

async function withFetch(mock, fn) {
  const original = global.fetch;
  global.fetch = mock;
  try {
    return await fn();
  } finally {
    global.fetch = original;
  }
}
const response = (data) => Response.json({ success: true, data });
const squad = loader()("@/lib/server/squad");

test("initialization uses sandbox Bearer auth, kobo and hosted checkout contract", async () => {
  await withFetch(
    async (url, options) => {
      assert.equal(
        url,
        "https://sandbox-api-d.squadco.com/transaction/initiate",
      );
      assert.equal(options.headers.Authorization, "Bearer test-key");
      const body = JSON.parse(options.body);
      assert.equal(body.amount, 12345);
      assert.equal(body.initiate_type, "inline");
      assert.equal(body.currency, "NGN");
      assert.equal(body.transaction_ref, "SQtest");
      assert.equal(body.pass_charge, false);
      return Response.json({
        status: 200,
        data: {
          checkout_url: "https://sandbox-pay.squadco.com/SQtest",
          transaction_ref: "SQtest",
        },
      });
    },
    async () => {
      const result = await squad.initializeSquadTransaction(
        { sandbox: true, secretKey: "test-key" },
        {
          email: "customer@example.com",
          amount: 123.45,
          reference: "SQtest",
          callbackUrl: "https://shopbeta.example/payments/callback",
          metadata: {},
        },
      );
      assert.equal(result.reference, "SQtest");
    },
  );
});

test("verification uses live endpoint and encoded reference", async () => {
  await withFetch(
    async (url, options) => {
      assert.equal(
        url,
        "https://api-d.squadco.com/transaction/verify/ref%2Fwith%20space",
      );
      assert.equal(options.headers.Authorization, "Bearer live-key");
      return response({ transaction_status: "Pending" });
    },
    () =>
      squad.verifySquadTransaction(
        { sandbox: false, secretKey: "live-key" },
        "ref/with space",
      ),
  );
});

test("initialization rejects untrusted checkout URLs and malformed responses", async () => {
  const input = {
    email: "c@example.com",
    amount: 10,
    reference: "SQtest",
    callbackUrl: "https://shopbeta.example",
    metadata: {},
  };
  for (const checkout_url of [
    "javascript:alert(1)",
    "https://squadco.com.evil.example/checkout",
    "http://pay.squadco.com/checkout",
  ]) {
    await withFetch(
      async () => response({ checkout_url }),
      () =>
        assert.rejects(
          squad.initializeSquadTransaction(
            { sandbox: true, secretKey: "test" },
            input,
          ),
        ),
    );
  }
  await withFetch(
    async () =>
      Response.json({ success: false, message: "secret provider response" }),
    () =>
      assert.rejects(
        squad.initializeSquadTransaction(
          { sandbox: true, secretKey: "test" },
          input,
        ),
        /could not process/,
      ),
  );
  await assert.rejects(
    squad.initializeSquadTransaction(
      { sandbox: true, secretKey: "test" },
      { ...input, amount: NaN },
    ),
  );
});

test("checkout webhook signature accepts uppercase hex and rejects forged/truncated payloads", () => {
  const raw = JSON.stringify({
    Event: "charge_successful",
    TransactionRef: "SQtest",
  });
  const signature = crypto
    .createHmac("sha512", "secret")
    .update(raw)
    .digest("hex");
  assert.equal(
    squad.verifySquadWebhookSignature(raw, signature.toUpperCase(), "secret"),
    true,
  );
  assert.equal(
    squad.verifySquadWebhookSignature(raw + " ", signature, "secret"),
    false,
  );
  for (const invalid of [null, "abc", "g".repeat(128), "0".repeat(128)])
    assert.equal(
      squad.verifySquadWebhookSignature(raw, invalid, "secret"),
      false,
    );
});

test("verified amount normalizes kobo, maps statuses and checks reference/currency/customer", () => {
  const valid = fixture().verified;
  assert.equal(squad.normalizeSquadVerification(valid).amount, 100);
  const expected = {
    reference: valid.transaction_ref,
    amount: 100,
    email: valid.email,
  };
  assert.equal(squad.validateSquadPayment(valid, expected), null);
  for (const patch of [
    { transaction_amount: 9999 },
    { transaction_amount: NaN },
    { transaction_ref: "other" },
    { transaction_currency_id: "USD" },
    { email: "other@example.com" },
  ]) {
    assert.ok(squad.validateSquadPayment({ ...valid, ...patch }, expected));
  }
  for (const [status, expectedStatus] of [
    ["Failed", "failed"],
    ["Abandoned", "cancelled"],
    ["Pending", "processing"],
  ]) {
    assert.equal(
      squad.normalizeSquadVerification({ ...valid, transaction_status: status })
        .status,
      expectedStatus,
    );
  }
});

test("admin configuration reads private keys, defaults to hidden, and preserves attempt environment", async () => {
  const f = fixture();
  const getConfig = f.load("@/lib/server/squad-settings").getSquadConfiguration;
  assert.equal((await getConfig()).secretKey, "sandbox-secret");
  f.records.get("settings/app").payments.squadSandbox = false;
  assert.equal((await getConfig()).secretKey, "live-secret");
  assert.equal((await getConfig(true)).secretKey, "sandbox-secret");
  f.records.set("settings/app", {});
  const original = process.env.NEXT_PUBLIC_SQUAD_ENABLED;
  delete process.env.NEXT_PUBLIC_SQUAD_ENABLED;
  try {
    assert.equal((await getConfig()).enabled, false);
  } finally {
    if (original !== undefined)
      process.env.NEXT_PUBLIC_SQUAD_ENABLED = original;
  }
});

test("disabled Squad never initializes; existing provider orders remain untouched", async () => {
  for (const options of [
    { enabled: false },
    { method: "paystack" },
    { method: "korapay" },
    { method: "cash-on-delivery" },
  ]) {
    const f = fixture(options);
    await withFetch(
      () => {
        throw new Error("must not contact Squad");
      },
      async () => {
        const initialize = f.load(
          "@/lib/server/squad-payment-service",
        ).initializeSquadForOrder;
        if (options.enabled === false)
          assert.equal((await initialize("order-1")).ok, false);
        else await assert.rejects(initialize("order-1"), /not set up/);
      },
    );
    assert.equal(f.records.get("products/product-1").stock, 10);
    assert.equal(f.records.get("orders/order-1").paymentStatus, "pending");
  }
});

test("attempt is persisted before initialization; callback contains trusted origin and Squad dispatch", async () => {
  const f = fixture();
  await withFetch(
    async (_, options) => {
      const body = JSON.parse(options.body);
      const callback = new URL(body.callback_url);
      assert.equal(callback.origin, "https://shopbeta.example");
      assert.equal(callback.searchParams.get("provider"), "squad");
      assert.equal(
        callback.searchParams.get("reference"),
        body.transaction_ref,
      );
      assert.equal(
        f.records.get("orders/order-1").paymentReference,
        body.transaction_ref,
      );
      assert.ok(
        [...f.records.values()].find(
          (p) => p.gateway === "squad" && p.reference === body.transaction_ref,
        ),
      );
      return response({
        checkout_url: `https://sandbox-pay.squadco.com/${body.transaction_ref}`,
      });
    },
    async () =>
      assert.equal(
        (
          await f
            .load("@/lib/server/squad-payment-service")
            .initializeSquadForOrder("order-1")
        ).ok,
        true,
      ),
  );
  assert.equal(f.records.get("products/product-1").stock, 10);
});

test("callback plus duplicate webhook finalize stock once even after Squad is hidden", async () => {
  const f = fixture({ enabled: false });
  await withFetch(
    async () => response(f.verified),
    async () => {
      const verify = f.load(
        "@/lib/server/squad-payment-service",
      ).verifySquadForReference;
      assert.equal((await verify(f.reference)).ok, true);
      const second = await verify(
        f.reference,
        `charge_successful:${f.reference}`,
      );
      assert.equal(second.ok, true);
      assert.equal(second.alreadyProcessed, true);
      assert.equal(
        (await verify(f.reference, `charge_successful:${f.reference}`))
          .alreadyProcessed,
        true,
      );
    },
  );
  assert.equal(f.records.get("products/product-1").stock, 8);
  assert.equal(f.records.get("orders/order-1").paymentStatus, "paid");
  assert.equal(f.records.get("payments/attempt-1").status, "paid");
});

test("pending, failed and mismatched payments never decrement stock", async () => {
  for (const patch of [
    { transaction_status: "Pending" },
    { transaction_status: "Failed" },
    { transaction_amount: 9999 },
    { transaction_currency_id: "USD" },
    { transaction_ref: "other" },
    { email: "other@example.com" },
  ]) {
    const f = fixture();
    await withFetch(
      async () => response({ ...f.verified, ...patch }),
      async () => {
        assert.equal(
          (
            await f
              .load("@/lib/server/squad-payment-service")
              .verifySquadForReference(f.reference)
          ).ok,
          false,
        );
      },
    );
    assert.equal(f.records.get("products/product-1").stock, 10);
    assert.notEqual(f.records.get("orders/order-1").paymentStatus, "paid");
  }
});

test("verification rejects references belonging to a different gateway", async () => {
  const f = fixture();
  f.records.get("payments/attempt-1").gateway = "paystack";
  await withFetch(
    () => {
      throw new Error("must not contact Squad");
    },
    async () => {
      assert.equal(
        (
          await f
            .load("@/lib/server/squad-payment-service")
            .verifySquadForReference(f.reference)
        ).ok,
        false,
      );
    },
  );
});

test("older failed attempts do not overwrite a newer Squad retry", async () => {
  const f = fixture();
  f.records.get("orders/order-1").paymentReference = "new-reference";
  await withFetch(
    async () => response({ ...f.verified, transaction_status: "Failed" }),
    async () => {
      assert.equal(
        (
          await f
            .load("@/lib/server/squad-payment-service")
            .verifySquadForReference(f.reference)
        ).ok,
        false,
      );
    },
  );
  assert.equal(f.records.get("orders/order-1").paymentStatus, "pending");
});

test("webhook rejects invalid signatures before verification and accepts signed live events in sandbox mode", async () => {
  const f = fixture();
  const route = f.load("@/app/api/payments/squad/webhook/route");
  const raw = JSON.stringify({
    Event: "charge_successful",
    TransactionRef: f.reference,
    Body: { transaction_ref: f.reference },
  });
  const request = (signature) =>
    new Request("https://shopbeta.example/api/payments/squad/webhook", {
      method: "POST",
      body: raw,
      headers: { "x-squad-encrypted-body": signature },
    });
  await withFetch(
    () => {
      throw new Error("invalid signature must not verify");
    },
    async () => {
      assert.equal((await route.POST(request("0".repeat(128)))).status, 401);
    },
  );
  const signature = crypto
    .createHmac("sha512", "live-secret")
    .update(raw)
    .digest("hex")
    .toUpperCase();
  await withFetch(
    async () => response(f.verified),
    async () =>
      assert.equal((await route.POST(request(signature))).status, 200),
  );
  assert.equal(f.records.get("products/product-1").stock, 8);
});

test("webhook returns retryable failure on provider outage", async () => {
  const f = fixture();
  const raw = JSON.stringify({
    Event: "charge_successful",
    TransactionRef: f.reference,
  });
  const signature = crypto
    .createHmac("sha512", "sandbox-secret")
    .update(raw)
    .digest("hex");
  await withFetch(
    async () => {
      throw new Error("outage");
    },
    async () => {
      const result = await f
        .load("@/app/api/payments/squad/webhook/route")
        .POST(
          new Request("https://shopbeta.example/api/payments/squad/webhook", {
            method: "POST",
            body: raw,
            headers: { "x-squad-encrypted-body": signature },
          }),
        );
      assert.equal(result.status, 500);
    },
  );
  assert.equal(f.records.get("products/product-1").stock, 10);
});

test("a transient failed verification never consumes a later successful webhook event", async () => {
  const f = fixture();
  const verify = f.load(
    "@/lib/server/squad-payment-service",
  ).verifySquadForReference;
  const eventId = `charge_successful:${f.reference}`;
  await withFetch(
    async () => response({ ...f.verified, transaction_status: "Failed" }),
    async () => {
      assert.equal((await verify(f.reference, eventId)).ok, false);
    },
  );
  await withFetch(
    async () => response(f.verified),
    async () => assert.equal((await verify(f.reference, eventId)).ok, true),
  );
  assert.equal(f.records.get("products/product-1").stock, 8);
  assert.equal(f.records.get("orders/order-1").paymentStatus, "paid");
});

test("public payment settings expose visibility without returning Squad keys", async () => {
  const load = loader({
    "@/services/settings.service": {
      getAppSettings: async () => ({
        storeInformation: { name: "ShopBeta" },
        payments: {
          squadEnabled: true,
          paystackEnabled: true,
          korapayEnabled: false,
          codEnabled: true,
        },
        paymentSecrets: { squadSecretKey: "must-not-be-returned" },
      }),
    },
  });
  const result = await load("@/app/api/payment-settings/route").GET();
  const settings = await result.json();
  assert.equal(settings.squad, true);
  assert.equal(settings.paystack, true);
  assert.equal(settings.korapay, false);
  assert.equal(settings.cod, true);
  assert.deepEqual(Object.keys(settings).sort(), [
    "bachs",
    "bachsFieldsConfigured",
    "bachsKeyConfigured",
    "cod",
    "codAllowedStates",
    "flutterwave",
    "flutterwaveKeyConfigured",
    "korapay",
    "korapayKeyConfigured",
    "monnify",
    "monnifyKeyConfigured",
    "paystack",
    "paystackKeyConfigured",
    "squad",
    "squadKeyConfigured",
  ]);
  assert.equal(
    JSON.stringify(settings).includes("must-not-be-returned"),
    false,
  );
});

test("admin secret saves write only the private document and retain blank keys", async () => {
  const writes = [];
  const load = loader({
    "firebase/firestore": {
      doc: (_, ...parts) => parts.join("/"),
      serverTimestamp: () => "server-time",
      setDoc: async (...args) => writes.push(args),
    },
    "@/firebase/firestore": { getDb: () => ({}) },
    "@/services/settings.service": {
      getAppSettings: async () => ({ storeInformation: { name: "ShopBeta" } }),
    },
  });
  const save = load("@/services/squad-settings.service").saveSquadSecrets;
  await save({ sandboxSecretKey: " ", liveSecretKey: "" });
  assert.equal(writes.length, 0);
  await save({ sandboxSecretKey: " sandbox-secret ", liveSecretKey: "" });
  assert.deepEqual(writes[0], [
    "privatePaymentSettings/squad",
    { sandboxSecretKey: "sandbox-secret", updatedAt: "server-time" },
    { merge: true },
  ]);
});

test("failed verification cannot overwrite a success that arrived during the API request", async () => {
  const f = fixture();
  await withFetch(
    async () => {
      f.records.get("orders/order-1").paymentStatus = "paid";
      f.records.get("payments/attempt-1").status = "paid";
      return response({ ...f.verified, transaction_status: "Failed" });
    },
    async () =>
      f
        .load("@/lib/server/squad-payment-service")
        .verifySquadForReference(f.reference),
  );
  assert.equal(f.records.get("orders/order-1").paymentStatus, "paid");
  assert.equal(f.records.get("payments/attempt-1").status, "paid");
});
