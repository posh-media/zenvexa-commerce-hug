const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loader, database } = require("./payment-test-helpers.cjs");
function harness() {
  process.env.NEXT_PUBLIC_STORE_ID = "zenvexa";
  process.env.STORE_ID = "zenvexa";
  const { db, records } = database({
    "settings/app": { storeInformation: { name: "ShopBeta" } },
    "settings/Zenvexa": {
      storeId: "zenvexa",
      storeInformation: { name: "Zenvexa", tagline: "Original" },
      payments: { paystackEnabled: true },
      notifications: { orderEmailEnabled: true },
    },
    "privatePaymentSettings/zenvexa/providers/paystack": {
      secretKey: "existing-key",
    },
  });
  const writes = [],
    audits = [];
  const firestore = {
    doc: (_db, ...parts) => ({ path: parts.join("/") }),
    getDoc: async (ref) => ({
      exists: () => records.has(ref.path),
      data: () => records.get(ref.path),
    }),
    setDoc: async (ref, data) => {
      writes.push(ref.path);
      const merge = (a, b) => {
        const out = { ...a };
        for (const [k, v] of Object.entries(b)) {
          if (v === "__DELETE__") delete out[k];
          else if (v && typeof v === "object" && !Array.isArray(v))
            out[k] = merge(out[k], v);
          else out[k] = v;
        }
        return out;
      };
      records.set(ref.path, merge(records.get(ref.path), data));
    },
    deleteField: () => "__DELETE__",
    serverTimestamp: () => "timestamp",
  };
  const load = loader({
    "firebase/firestore": firestore,
    "@/firebase/firestore": { getDb: () => ({}) },
    "@/firebase/collections": {
      settingsDoc: () => ({ path: "settings/Zenvexa" }),
    },
    "@/lib/server/firebase-admin": {
      getAdminDb: () => db,
      isFirebaseAdminConfigured: () => true,
    },
    "@/services/audit.service": {
      writeAuditLog: async (data) => audits.push(data),
    },
  });
  return { records, load, writes, audits };
}
const actor = { id: "admin" };
test("partial store saves preserve name and nested values without touching ShopBeta", async () => {
  const f = harness();
  const settings = f.load("@/services/settings.service");
  await settings.updateAppSettings(
    {
      storeInformation: { tagline: "Changed" },
      payments: { korapayEnabled: true },
    },
    actor,
  );
  const result = f.records.get("settings/Zenvexa");
  assert.equal(result.storeInformation.name, "Zenvexa");
  assert.equal(result.storeInformation.tagline, "Changed");
  assert.equal(result.payments.paystackEnabled, true);
  assert.equal(result.payments.korapayEnabled, true);
  assert.equal(result.storeId, "zenvexa");
  assert.deepEqual(f.records.get("settings/app"), {
    storeInformation: { name: "ShopBeta" },
  });
});
test("blank/unknown store identities reject the save before any write", async () => {
  const f = harness();
  const service = f.load("@/services/settings.service");
  await assert.rejects(
    service.updateAppSettings({ storeInformation: { name: " \t " } }, actor),
    /Admin has not configured/,
  );
  await assert.rejects(
    service.updateAppSettings({ storeId: "shopbeta" }, actor),
    /mismatch/,
  );
  assert.equal(f.writes.length, 0);
});
test("blank keys preserve existing private keys and new values never reach public settings or audit", async () => {
  const f = harness();
  const service = f.load("@/services/settings.service");
  await service.updateAppSettings(
    { paymentSecrets: { paystackSecretKey: "  " } },
    actor,
  );
  assert.equal(
    f.records.get("privatePaymentSettings/zenvexa/providers/paystack")
      .secretKey,
    "existing-key",
  );
  await service.updateAppSettings(
    { paymentSecrets: { paystackSecretKey: " new-private-value " } },
    actor,
  );
  assert.equal(
    f.records.get("privatePaymentSettings/zenvexa/providers/paystack")
      .secretKey,
    "new-private-value",
  );
  assert.equal(f.records.get("settings/Zenvexa").paymentSecrets, undefined);
  assert.equal(JSON.stringify(f.audits).includes("new-private-value"), false);
});
test("webhook URLs are private and public readers also redact inherited sensitive fields", async () => {
  const f = harness();
  const service = f.load("@/services/settings.service");
  await service.updateAppSettings(
    {
      notifications: {
        makeWebhookUrl: "https://private.invalid/token",
        transactionalEmailWebhookUrl: "https://private.invalid/email",
      },
    },
    actor,
  );
  assert.equal(
    f.records.get("privateStoreSettings/zenvexa").makeWebhookUrl,
    "https://private.invalid/token",
  );
  assert.equal(
    f.records.get("settings/Zenvexa").notifications.makeWebhookUrl,
    undefined,
  );
  assert.equal(JSON.stringify(f.audits).includes("private.invalid"), false);
  f.records.get("settings/Zenvexa").paymentSecrets = {
    paystackSecretKey: "legacy-secret",
  };
  f.records.get("settings/Zenvexa").notifications.makeWebhookUrl =
    "inherited-url";
  assert.equal(
    JSON.stringify(await service.getAppSettings()).includes("legacy-secret"),
    false,
  );
  assert.equal(
    JSON.stringify(await service.getAppSettings()).includes("inherited-url"),
    false,
  );
});
test("Zenvexa does not use legacy ShopBeta provider secrets when its own key is missing", async () => {
  const f = harness();
  f.records.delete("privatePaymentSettings/zenvexa/providers/paystack");
  f.records.set("privatePaymentSettings/paystack", {
    secretKey: "wrong-store-key",
  });
  delete process.env.PAYSTACK_SECRET_KEY;
  assert.equal(
    await f.load("@/services/settings.service").getPaymentSecretKey("paystack"),
    undefined,
  );
});
