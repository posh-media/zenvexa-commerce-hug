const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loader } = require("./payment-test-helpers.cjs");
process.env.STORE_ID = "zenvexa";
process.env.NEXT_PUBLIC_STORE_ID = "zenvexa";

function route(settings, unavailable = false, privateUnavailable = false) {
  const load = loader({
    "@/lib/server/firebase-admin": { isFirebaseAdminConfigured: () => true },
    "@/services/settings.service": { getAppSettings: async () => { if (unavailable) throw new Error("Firebase Admin unavailable"); return settings; } },
    "@/lib/server/store-context": { providerSecrets: async (provider) => {
      if (provider === "squad" && privateUnavailable) throw new Error("Private read failed");
      return provider === "squad" ? { liveSecretKey: "fixture-secret-not-a-real-key" } : {};
    } },
  });
  return load("@/app/api/payment-settings/route").GET;
}

test("enabled scoped Squad configuration survives repeated reads without exposing its private key", async () => {
  const get = route({ storeId: "zenvexa", storeInformation: { name: "Zenvexa" }, payments: { squadEnabled: true, squadSandbox: false } });
  for (let i = 0; i < 2; i++) {
    const response = await get();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.squad, true);
    assert.equal(body.squadKeyConfigured.liveSecretKey, true);
    assert.equal(body.squadKeyConfigured.sandboxSecretKey, false);
    assert.ok(!JSON.stringify(body).includes("fixture-secret-not-a-real-key"));
  }
});

test("backend configuration failures are not falsely reported as a missing store name", async () => {
  const response = await route(undefined, true)();
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "PAYMENT_CONFIGURATION_UNAVAILABLE");
  assert.equal(body.squad, false);
  assert.match(body.reason, /server Firebase Admin/);
});

test("a failed private credential read reports unavailable instead of a false not-configured flag", async () => {
  const response = await route({ storeId: "zenvexa", storeInformation: { name: "Zenvexa" }, payments: { squadEnabled: true } }, false, true)();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "PAYMENT_CONFIGURATION_UNAVAILABLE");
});

test("an actually blank store name remains a distinct configuration error", async () => {
  const response = await route({ storeId: "zenvexa", storeInformation: { name: " " } })();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "STORE_NAME_MISSING");
});

test("a 503 never enables environment fallback or poisons the next successful Squad availability read", async () => {
  const previousWindow = global.window;
  const previousFetch = global.fetch;
  const previousEnv = process.env.NEXT_PUBLIC_SQUAD_ENABLED;
  global.window = {};
  process.env.NEXT_PUBLIC_SQUAD_ENABLED = "true";
  let calls = 0;
  global.fetch = async () => ++calls === 1
    ? new Response(JSON.stringify({ ok: false, squad: false }), { status: 503 })
    : new Response(JSON.stringify({ squad: true, cod: false, codAllowedStates: [] }), { status: 200 });
  try {
    const service = loader()('@/services/payments.service');
    const failed = await service.getPaymentProviderSettings();
    assert.equal(failed.squad, false);
    assert.equal(failed.cod, false);
    assert.ok(failed.availabilityError);
    const recovered = await service.getPaymentProviderSettings();
    assert.equal(recovered.squad, true);
    assert.equal(recovered.availabilityError, undefined);
    assert.equal(calls, 2);
    await service.getPaymentProviderSettings();
    assert.equal(calls, 2);
    service.clearPaymentProviderSettingsCache();
    await service.getPaymentProviderSettings();
    assert.equal(calls, 3);
  } finally {
    global.fetch = previousFetch;
    if (previousWindow === undefined) delete global.window; else global.window = previousWindow;
    if (previousEnv === undefined) delete process.env.NEXT_PUBLIC_SQUAD_ENABLED; else process.env.NEXT_PUBLIC_SQUAD_ENABLED = previousEnv;
  }
});

test("server rendering does not issue a relative payment-settings fetch or guess enabled providers", async () => {
  const oldFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error("Unexpected SSR fetch"); };
  try {
    const settings = await loader()('@/services/payments.service').getPaymentProviderSettings();
    assert.equal(calls, 0);
    assert.equal(settings.squad, false);
    assert.equal(settings.cod, false);
  } finally { global.fetch = oldFetch; }
});
