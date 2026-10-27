const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { loader, database, withFetch } = require("./payment-test-helpers.cjs");
function fixture({ enabled = true, method = "monnify" } = {}) {
  const reference = `MN${"a".repeat(32)}`;
  const { db, records } = database({
    "settings/app": {
      payments: { monnifyEnabled: enabled, monnifySandbox: true },
    },
    "privatePaymentSettings/monnify": {
      sandboxSecretKey: "sandbox-secret",
      sandboxApiKey: "sandbox-api",
      sandboxContractCode: "sandbox-contract",
      liveApiKey: "live-api",
      liveContractCode: "live-contract",
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
      gateway: "monnify",
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
    amountPaid: "100.00",
    paymentReference: reference,
    transactionReference: "MNFY|1",
    paymentStatus: "PAID",
    currencyCode: "NGN",
    customerDTO: { email: "customer@example.com" },
  };
  return {
    load,
    records,
    reference,
    verified,
    notifications: () => notifications,
  };
}

const response = (responseBody) =>
  Response.json({ requestSuccessful: true, responseBody });
const monnify = loader()("@/lib/server/monnify");
const credentials = {
  sandbox: true,
  apiKey: "api",
  secretKey: "secret",
  contractCode: "contract",
};
const authOr = (fn) => async (url, options) =>
  url.endsWith("/auth/login")
    ? response({ accessToken: "token", expiresIn: 3600 })
    : fn(url, options);

test("hosted initialization authenticates server-side and sends major-unit NGN", async () => {
  let calls = 0;
  await withFetch(
    async (url, options) => {
      calls++;
      if (calls === 1) {
        assert.equal(url, "https://sandbox.monnify.com/api/v1/auth/login");
        assert.equal(
          options.headers.Authorization,
          `Basic ${Buffer.from("api:secret").toString("base64")}`,
        );
        return response({ accessToken: "token" });
      }
      assert.equal(
        url,
        "https://sandbox.monnify.com/api/v1/merchant/transactions/init-transaction",
      );
      assert.equal(options.headers.Authorization, "Bearer token");
      const body = JSON.parse(options.body);
      assert.equal(body.amount, 123.45);
      assert.equal(body.currencyCode, "NGN");
      assert.equal(body.contractCode, "contract");
      assert.equal(body.paymentReference, "MNtest");
      assert.equal(body.customerName, "Customer");
      assert.equal(
        body.redirectUrl,
        "https://shopbeta.example/payments/callback",
      );
      assert.equal(body.paymentMethods, undefined);
      return response({
        checkoutUrl: "https://sandbox.sdk.monnify.com/checkout/1",
        paymentReference: "MNtest",
        transactionReference: "MNFY|1",
      });
    },
    async () => {
      const result = await monnify.initializeMonnifyTransaction(credentials, {
        amount: 123.45,
        email: "customer@example.com",
        customerName: "Customer",
        reference: "MNtest",
        callbackUrl: "https://shopbeta.example/payments/callback",
        metadata: {},
      });
      assert.equal(result.reference, "MNtest");
      assert.equal(result.transactionReference, "MNFY|1");
    },
  );
});

test("live verification queries encoded merchant reference using live credentials", async () => {
  await withFetch(
    async (url, options) => {
      assert.ok(url.startsWith("https://api.monnify.com/"));
      if (url.endsWith("/auth/login"))
        return response({ accessToken: "live-token" });
      assert.equal(
        url,
        "https://api.monnify.com/api/v2/merchant/transactions/query?paymentReference=MN%7Cref",
      );
      assert.equal(options.headers.Authorization, "Bearer live-token");
      return response({ paymentReference: "MN|ref" });
    },
    async () =>
      assert.equal(
        (
          await monnify.verifyMonnifyTransaction(
            { ...credentials, sandbox: false },
            "MN|ref",
          )
        ).paymentReference,
        "MN|ref",
      ),
  );
});

test("checkout rejects unexpected references and untrusted redirects", async () => {
  for (const patch of [
    { paymentReference: "wrong" },
    { transactionReference: "" },
    { checkoutUrl: "https://monnify.com.attacker.example/checkout" },
    { checkoutUrl: "http://sdk.monnify.com/checkout" },
  ]) {
    await withFetch(
      authOr(() =>
        response({
          checkoutUrl: "https://sdk.monnify.com/checkout",
          paymentReference: "MNtest",
          transactionReference: "MNFY|1",
          ...patch,
        }),
      ),
      async () =>
        assert.rejects(
          monnify.initializeMonnifyTransaction(credentials, {
            amount: 100,
            reference: "MNtest",
            email: "a@example.com",
            callbackUrl: "https://shopbeta.example",
            metadata: {},
          }),
        ),
    );
  }
});

test("authentication failures are redacted and never call transaction endpoint", async () => {
  let calls = 0;
  await withFetch(
    () => {
      calls++;
      return Response.json({
        requestSuccessful: false,
        responseMessage: "secret-provider-detail",
      });
    },
    async () => {
      await assert.rejects(
        monnify.verifyMonnifyTransaction(credentials, "MNtest"),
        (error) => !error.message.includes("secret-provider-detail"),
      );
    },
  );
  assert.equal(calls, 1);
});

test("only PAID normalizes to fulfillment; partial and overpayment wait for review", () => {
  for (const status of ["PENDING", "PARTIALLY_PAID", "OVERPAID", "unknown"])
    assert.equal(
      monnify.normalizeMonnifyVerification({ paymentStatus: status }).status,
      "processing",
    );
  for (const status of ["FAILED", "REVERSED", "EXPIRED"])
    assert.equal(
      monnify.normalizeMonnifyVerification({ paymentStatus: status }).status,
      "failed",
    );
});

test("validation rejects wrong amount, currency, customer and transaction identity", () => {
  const f = fixture();
  const expected = {
    reference: f.reference,
    amount: 100,
    email: "customer@example.com",
    transactionReference: "MNFY|1",
  };
  assert.equal(monnify.validateMonnifyPayment(f.verified, expected), null);
  for (const patch of [
    { amountPaid: 99 },
    { amountPaid: "invalid" },
    { currencyCode: "USD" },
    { paymentReference: "wrong" },
    { transactionReference: "MNFY|2" },
    { customerDTO: { email: "other@example.com" } },
  ])
    assert.ok(
      monnify.validateMonnifyPayment({ ...f.verified, ...patch }, expected),
    );
  assert.equal(
    monnify.validateMonnifyPayment(
      {
        ...f.verified,
        currencyCode: undefined,
        currency: "NGN",
        customerDTO: undefined,
        customer: { email: "customer@example.com" },
      },
      expected,
    ),
    null,
  );
});

test("private configuration keeps credentials out of public settings and preserves attempt mode", async () => {
  const f = fixture();
  f.records.get("settings/app").payments.monnifySandbox = false;
  const config = await f
    .load("@/lib/server/monnify-settings")
    .getMonnifyConfiguration();
  assert.equal(config.apiKey, "live-api");
  assert.equal(config.contractCode, "live-contract");
  assert.equal(
    (
      await f
        .load("@/lib/server/monnify-settings")
        .getMonnifyConfiguration(true)
    ).secretKey,
    "sandbox-secret",
  );
});

test("disabled or wrong-provider orders cannot initialize Monnify", async () => {
  for (const options of [
    { enabled: false },
    { method: "paystack" },
    { method: "squad" },
  ]) {
    const f = fixture(options);
    await withFetch(
      () => {
        throw new Error("Unexpected network request");
      },
      async () => {
        const service = f.load("@/lib/server/monnify-payment-service");
        if (options.enabled === false)
          assert.equal(
            (await service.initializeMonnifyForOrder("order-1")).ok,
            false,
          );
        else await assert.rejects(service.initializeMonnifyForOrder("order-1"));
      },
    );
  }
});

test("initialization records unique attempts before API and uses trusted callback", async () => {
  const f = fixture();
  let attempts = [];
  await withFetch(
    authOr((url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(
        f.records.get("orders/order-1").paymentReference,
        body.paymentReference,
      );
      assert.match(body.paymentReference, /^MN[a-f0-9]{32}$/);
      const callback = new URL(body.redirectUrl);
      assert.equal(callback.origin, "https://shopbeta.example");
      assert.equal(callback.searchParams.get("provider"), "monnify");
      assert.equal(
        callback.searchParams.get("reference"),
        body.paymentReference,
      );
      attempts.push(body.paymentReference);
      return response({
        checkoutUrl: "https://sandbox.sdk.monnify.com/checkout",
        paymentReference: body.paymentReference,
        transactionReference: `MNFY|${attempts.length}`,
      });
    }),
    async () => {
      const service = f.load("@/lib/server/monnify-payment-service");
      await service.initializeMonnifyForOrder("order-1");
      await service.initializeMonnifyForOrder("order-1");
    },
  );
  assert.notEqual(attempts[0], attempts[1]);
  assert.equal(
    f.records.get("payments/payment-2").transactionReference,
    "MNFY|2",
  );
  assert.equal(f.records.get("payments/payment-2").metadata.sandbox, true);
});

test("failed initialization retains attempt for reconciliation", async () => {
  const f = fixture();
  await withFetch(
    async () => {
      throw new Error("Timeout");
    },
    async () =>
      assert.rejects(
        f
          .load("@/lib/server/monnify-payment-service")
          .initializeMonnifyForOrder("order-1"),
      ),
  );
  assert.equal(f.records.get("payments/payment-1").initializationFailed, true);
});

test("verified success finalizes stock once despite duplicate callback and webhook", async () => {
  const f = fixture();
  await withFetch(
    authOr(() => response(f.verified)),
    async () => {
      const service = f.load("@/lib/server/monnify-payment-service");
      assert.equal(
        (await service.verifyMonnifyForReference(f.reference)).ok,
        true,
      );
      const second = await service.verifyMonnifyForReference(
        f.reference,
        `SUCCESSFUL_TRANSACTION:${f.reference}`,
      );
      assert.equal(second.ok, true);
      assert.equal(second.alreadyProcessed, true);
    },
  );
  assert.equal(f.records.get("orders/order-1").paymentStatus, "paid");
  assert.equal(f.records.get("products/product-1").stock, 8);
});

test("hidden provider still verifies its recorded sandbox attempts", async () => {
  const f = fixture({ enabled: false });
  f.records.get("settings/app").payments.monnifySandbox = false;
  await withFetch(
    authOr((url) => {
      assert.ok(url.startsWith("https://sandbox.monnify.com"));
      return response(f.verified);
    }),
    async () =>
      assert.equal(
        (
          await f
            .load("@/lib/server/monnify-payment-service")
            .verifyMonnifyForReference(f.reference)
        ).ok,
        true,
      ),
  );
});

test("wrong amount cannot mark an order paid or consume stock", async () => {
  const f = fixture();
  await withFetch(
    authOr(() => response({ ...f.verified, amountPaid: "99.00" })),
    async () =>
      assert.equal(
        (
          await f
            .load("@/lib/server/monnify-payment-service")
            .verifyMonnifyForReference(f.reference)
        ).ok,
        false,
      ),
  );
  assert.equal(f.records.get("products/product-1").stock, 10);
  assert.equal(f.records.get("orders/order-1").paymentStatus, "pending");
});

test("late failure cannot overwrite paid orders or newer retry references", async () => {
  for (const state of [
    { paymentStatus: "paid" },
    { paymentReference: `MN${"b".repeat(32)}`, paymentStatus: "processing" },
  ]) {
    const f = fixture();
    await withFetch(
      authOr(() => {
        Object.assign(f.records.get("orders/order-1"), state);
        return response({ ...f.verified, paymentStatus: "FAILED" });
      }),
      async () =>
        assert.equal(
          (
            await f
              .load("@/lib/server/monnify-payment-service")
              .verifyMonnifyForReference(f.reference)
          ).ok,
          false,
        ),
    );
    for (const [key, value] of Object.entries(state))
      assert.equal(f.records.get("orders/order-1")[key], value);
  }
});

test("raw-body HMAC detects tampering and malformed signatures", () => {
  const raw = '{"eventType":"SUCCESSFUL_TRANSACTION"}';
  const signature = crypto
    .createHmac("sha512", "secret")
    .update(raw)
    .digest("hex");
  assert.equal(
    monnify.verifyMonnifyWebhookSignature(raw, signature, "secret"),
    true,
  );
  for (const value of [null, "", "bad", "a".repeat(128)])
    assert.equal(
      monnify.verifyMonnifyWebhookSignature(raw, value, "secret"),
      false,
    );
  assert.equal(
    monnify.verifyMonnifyWebhookSignature(raw + " ", signature, "secret"),
    false,
  );
});

function webhookRequest(f, signature) {
  const raw = JSON.stringify({
    eventType: "SUCCESSFUL_TRANSACTION",
    eventData: {
      paymentReference: f.reference,
      paymentStatus: "PAID",
      amountPaid: 999999,
    },
  });
  return new Request("https://shopbeta.example/api/payments/monnify/webhook", {
    method: "POST",
    body: raw,
    headers:
      signature === undefined
        ? {}
        : {
            "monnify-signature":
              signature === true
                ? crypto
                    .createHmac("sha512", "live-secret")
                    .update(raw)
                    .digest("hex")
                : signature,
          },
  });
}

test("unsigned sandbox webhook only settles after authoritative API verification", async () => {
  const f = fixture();
  await withFetch(
    authOr(() => response(f.verified)),
    async () => {
      const result = await f
        .load("@/app/api/payments/monnify/webhook/route")
        .POST(webhookRequest(f));
      assert.equal(result.status, 200);
    },
  );
  assert.equal(f.records.get("orders/order-1").paymentStatus, "paid");
});

test("live webhook rejects unsigned, malformed and sandbox-signed notifications", async () => {
  for (const signature of [undefined, "", "bad", "a".repeat(128)]) {
    const f = fixture();
    f.records.get("payments/attempt-1").metadata.sandbox = false;
    await withFetch(
      () => {
        throw new Error("Unexpected verification");
      },
      async () =>
        assert.equal(
          (
            await f
              .load("@/app/api/payments/monnify/webhook/route")
              .POST(webhookRequest(f, signature))
          ).status,
          401,
        ),
    );
    assert.equal(f.records.get("orders/order-1").paymentStatus, "pending");
  }
});

test("signed live webhook verifies original live mode even after admin switches to sandbox", async () => {
  const f = fixture();
  f.records.get("payments/attempt-1").metadata.sandbox = false;
  await withFetch(
    authOr((url) => {
      assert.ok(url.startsWith("https://api.monnify.com/"));
      return response(f.verified);
    }),
    async () =>
      assert.equal(
        (
          await f
            .load("@/app/api/payments/monnify/webhook/route")
            .POST(webhookRequest(f, true))
        ).status,
        200,
      ),
  );
});

test("sandbox payload claiming payment success cannot fulfill a pending API transaction", async () => {
  const f = fixture();
  await withFetch(
    authOr(() => response({ ...f.verified, paymentStatus: "PENDING" })),
    async () =>
      assert.equal(
        (
          await f
            .load("@/app/api/payments/monnify/webhook/route")
            .POST(webhookRequest(f))
        ).status,
        500,
      ),
  );
  assert.equal(f.records.get("products/product-1").stock, 10);
});

test("unknown or other-provider webhook references never call Monnify", async () => {
  const f = fixture();
  f.records.get("payments/attempt-1").gateway = "squad";
  await withFetch(
    () => {
      throw new Error("Unexpected network call");
    },
    async () =>
      assert.equal(
        (
          await f
            .load("@/app/api/payments/monnify/webhook/route")
            .POST(webhookRequest(f))
        ).status,
        200,
      ),
  );
});

test("admin saves only supplied credentials privately and blank fields retain existing values", async () => {
  const writes = [];
  const load = loader({
    "firebase/firestore": {
      doc: (_, collection, id) => `${collection}/${id}`,
      serverTimestamp: () => "server-time",
      setDoc: async (...args) => writes.push(args),
    },
    "@/firebase/firestore": { getDb: () => ({}) },
  });
  const save = load("@/services/monnify-settings.service").saveMonnifySecrets;
  await save({
    sandboxApiKey: " test-api ",
    sandboxSecretKey: " test-secret ",
    sandboxContractCode: " contract ",
    liveSecretKey: " ",
  });
  assert.deepEqual(writes, [
    [
      "privatePaymentSettings/monnify",
      {
        sandboxApiKey: "test-api",
        sandboxSecretKey: "test-secret",
        sandboxContractCode: "contract",
        updatedAt: "server-time",
      },
      { merge: true },
    ],
  ]);
  await save({});
  assert.equal(writes.length, 1);
});

test("public provider settings expose only visibility and retain existing provider values", async () => {
  const load = loader({
    "@/services/settings.service": {
      getAppSettings: async () => ({
        payments: {
          monnifyEnabled: true,
          squadEnabled: true,
          paystackEnabled: false,
          korapayEnabled: true,
          flutterwaveEnabled: false,
          codEnabled: true,
        },
        paymentSecrets: { monnifySecretKey: "never-public" },
      }),
    },
  });
  const result = await load("@/app/api/payment-settings/route").GET();
  assert.deepEqual(await result.json(), {
    monnify: true,
    squad: true,
    paystack: false,
    korapay: true,
    flutterwave: false,
    bachs: false,
    cod: true,
    codAllowedStates: [],
    paystackKeyConfigured: false,
    korapayKeyConfigured: false,
    flutterwaveKeyConfigured: false,
    bachsKeyConfigured: false,
    squadKeyConfigured: { sandboxSecretKey: false, liveSecretKey: false },
    monnifyKeyConfigured: {
      sandboxApiKey: false,
      sandboxSecretKey: false,
      sandboxContractCode: false,
      liveApiKey: false,
      liveSecretKey: false,
      liveContractCode: false,
    },
    bachsFieldsConfigured: {
      sandboxApiKey: false,
      liveApiKey: false,
      sandboxWebhookSecret: false,
      liveWebhookSecret: false,
    },
  });
});
