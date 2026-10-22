const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loader } = require("./payment-test-helpers.cjs");

// In-memory Firestore mock for the client SDK surface used by
// settings.service.ts.
function harness(initial = {}) {
  const records = new Map(
    Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]),
  );
  const audits = [];
  const writes = [];

  const firestore = {
    doc: (_db, ...parts) => ({ path: parts.join("/") }),
    collection: (_db, name) => ({ path: name }),
    getDoc: async (ref) => ({
      exists: () => records.has(ref.path),
      data: () => records.get(ref.path),
    }),
    setDoc: async (ref, value, options) => {
      writes.push({ path: ref.path, value, options });
      const existing = records.get(ref.path) ?? {};
      const merged = { ...existing };
      for (const [key, v] of Object.entries(value)) {
        if (v === "__DELETE_FIELD__") {
          delete merged[key];
        } else if (
          options?.merge &&
          v &&
          typeof v === "object" &&
          !Array.isArray(v) &&
          !(v instanceof Date)
        ) {
          merged[key] = { ...(merged[key] ?? {}), ...v };
        } else {
          merged[key] = v;
        }
      }
      records.set(ref.path, merged);
    },
    deleteField: () => "__DELETE_FIELD__",
    serverTimestamp: () => "__TS__",
    addDoc: async (_col, value) => {
      records.set(`auto/${records.size}`, value);
      return { id: `auto-${records.size}` };
    },
  };

  const load = loader({
    "firebase/firestore": firestore,
    "@/firebase/firestore": { getDb: () => ({}) },
    "@/firebase/collections": {
      settingsDoc: () => ({ path: "settings/app" }),
    },
    "@/services/audit.service": {
      writeAuditLog: async (input) => audits.push(input),
    },
  });
  return { load, records, audits, writes };
}

const EXISTING_SETTINGS = {
  "settings/app": {
    storeInformation: { name: "ShopBeta", tagline: "Deals" },
    payments: {
      paystackEnabled: true,
      paystackPublicKeyHint: "pk_test_hint",
    },
    paymentSecrets: {
      paystackSecretKey: "sk_live_paystack",
      korapaySecretKey: "sk_live_korapay",
      flutterwaveSecretKey: "sk_live_flutterwave",
    },
    notifications: { orderEmailEnabled: true },
  },
};

const actor = { id: "admin-1", email: "admin@shopbeta.com" };

test("blank secret fields never overwrite existing keys", async () => {
  const { load, records } = harness(structuredClone(EXISTING_SETTINGS));
  const { updateAppSettings } = load("@/services/settings.service");

  await updateAppSettings(
    {
      storeInformation: { name: "Renamed Store" },
      paymentSecrets: {
        paystackSecretKey: "",
        korapaySecretKey: "   ",
        flutterwaveSecretKey: undefined,
      },
    },
    actor,
  );

  const doc = records.get("settings/app");
  assert.equal(doc.paymentSecrets.paystackSecretKey, "sk_live_paystack");
  assert.equal(doc.paymentSecrets.korapaySecretKey, "sk_live_korapay");
  assert.equal(doc.paymentSecrets.flutterwaveSecretKey, "sk_live_flutterwave");
  assert.equal(doc.storeInformation.name, "Renamed Store");
  assert.equal(doc.storeInformation.tagline, "Deals"); // merged, not dropped
});

test("a new non-empty key replaces only that provider's key", async () => {
  const { load, records } = harness(structuredClone(EXISTING_SETTINGS));
  const { updateAppSettings } = load("@/services/settings.service");

  await updateAppSettings(
    { paymentSecrets: { paystackSecretKey: "  sk_new  " } },
    actor,
  );

  const doc = records.get("settings/app");
  assert.equal(doc.paymentSecrets.paystackSecretKey, "sk_new");
  assert.equal(doc.paymentSecrets.korapaySecretKey, "sk_live_korapay");
  assert.equal(doc.paymentSecrets.flutterwaveSecretKey, "sk_live_flutterwave");
});

test("nested payment settings merge instead of wholesale replace", async () => {
  const { load, records } = harness(structuredClone(EXISTING_SETTINGS));
  const { updateAppSettings } = load("@/services/settings.service");

  await updateAppSettings(
    { payments: { codEnabled: false } },
    actor,
  );

  const doc = records.get("settings/app");
  assert.equal(doc.payments.codEnabled, false);
  assert.equal(doc.payments.paystackEnabled, true); // preserved
  assert.equal(doc.payments.paystackPublicKeyHint, "pk_test_hint"); // preserved
});

test("intentional false values are saved while omitted fields persist", async () => {
  const { load, records } = harness(structuredClone(EXISTING_SETTINGS));
  const { updateAppSettings } = load("@/services/settings.service");

  await updateAppSettings(
    { notifications: { orderEmailEnabled: false } },
    actor,
  );

  const doc = records.get("settings/app");
  assert.equal(doc.notifications.orderEmailEnabled, false);
});

test("audit log never receives secret values", async () => {
  const { load, audits } = harness(structuredClone(EXISTING_SETTINGS));
  const { updateAppSettings } = load("@/services/settings.service");

  await updateAppSettings(
    { paymentSecrets: { paystackSecretKey: "sk_super_secret_new" } },
    actor,
  );

  assert.equal(audits.length, 1);
  const serialized = JSON.stringify(audits[0]);
  assert.equal(serialized.includes("sk_live_paystack"), false);
  assert.equal(serialized.includes("sk_super_secret_new"), false);
  assert.equal(serialized.includes("[redacted]"), true);
});

test("saveProviderSecrets writes only non-blank keys to privatePaymentSettings", async () => {
  const { load, records } = harness({
    "privatePaymentSettings/paystack": {
      secretKey: "sk_live_paystack",
    },
  });
  const { saveProviderSecrets } = load("@/services/settings.service");

  await saveProviderSecrets({
    paystackSecretKey: "", // blank — must not overwrite
    korapaySecretKey: "  sk_new_korapay  ",
    flutterwaveSecretKey: "   ",
  });

  assert.equal(
    records.get("privatePaymentSettings/paystack").secretKey,
    "sk_live_paystack",
  );
  assert.equal(
    records.get("privatePaymentSettings/korapay").secretKey,
    "sk_new_korapay",
  );
  assert.equal(records.has("privatePaymentSettings/flutterwave"), false);
});

test("legacy keys migrate to privatePaymentSettings and are removed from settings", async () => {
  const { load, records } = harness(structuredClone(EXISTING_SETTINGS));
  const { migrateLegacyPaymentSecrets } = load("@/services/settings.service");

  await migrateLegacyPaymentSecrets();

  assert.equal(
    records.get("privatePaymentSettings/paystack").secretKey,
    "sk_live_paystack",
  );
  assert.equal(
    records.get("privatePaymentSettings/korapay").secretKey,
    "sk_live_korapay",
  );
  assert.equal(
    records.get("privatePaymentSettings/flutterwave").secretKey,
    "sk_live_flutterwave",
  );
  assert.equal("paymentSecrets" in records.get("settings/app"), false);

  // Second call is a no-op.
  await migrateLegacyPaymentSecrets();
  assert.equal("paymentSecrets" in records.get("settings/app"), false);
});

test("migration no-ops when there are no legacy secrets", async () => {
  const { load, records, writes } = harness({
    "settings/app": { storeInformation: { name: "ShopBeta" } },
  });
  const { migrateLegacyPaymentSecrets } = load("@/services/settings.service");

  await migrateLegacyPaymentSecrets();
  assert.equal(writes.length, 0);
});
