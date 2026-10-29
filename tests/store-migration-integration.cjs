// Integration against a disposable demo project only. Never run against production.
const assert = require("node:assert/strict");
const {
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
(async () => {
  if (
    !/^(127\.0\.0\.1|localhost):/.test(
      process.env.FIRESTORE_EMULATOR_HOST || "",
    )
  )
    throw new Error("Loopback demo Firestore emulator is required.");
  const reset = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-store-scope/databases/(default)/documents`,
    { method: "DELETE" },
  );
  assert.equal(
    reset.ok,
    true,
    "Reset only the loopback demo emulator before migration fixtures.",
  );
  initializeApp({ projectId: "demo-store-scope" });
  const db = getFirestore();
  const before = Timestamp.fromDate(new Date("2026-10-27T23:59:59.999Z"));
  const initial = {
    "settings/app": {
      storeInformation: { name: "ShopBeta" },
      paymentSecrets: { paystackSecretKey: "legacy-test-key" },
      notifications: { makeWebhookUrl: "https://example.invalid/test-secret" },
    },
    "privatePaymentSettings/squad": { sandboxSecretKey: "test-only" },
    "orders/migration-legacy": {
      createdAt: before,
      total: 123,
      paymentStatus: "pending",
    },
    "orders/migration-explicit": {
      createdAt: before,
      storeId: "zenvexa",
      storeName: "Zenvexa",
      total: 456,
    },
    "orders/migration-cutoff": {
      createdAt: Timestamp.fromDate(new Date("2026-10-28T00:00:00Z")),
    },
    "orders/migration-ambiguous": {
      createdAt: before,
      storeName: "Other store",
    },
    "orders/migration-no-date": { total: 10 },
    "orders/migration-named": { createdAt: before, storeName: "Zenvexa" },
    "orders/migration-concurrent": { createdAt: before, total: 1 },
  };
  for (const [ref, data] of Object.entries(initial))
    await db.doc(ref).set(data);
  const dir = mkdtempSync(path.join(tmpdir(), "store-migration-test-"));
  let file = path.join(dir, "backup.json");
  function run(extra = [], expectedStatus = 0) {
    try {
      return execFileSync(
        process.execPath,
        [
          "scripts/migrate-store-data.mjs",
          "--project",
          "demo-store-scope",
          "--file",
          file,
          ...extra,
        ],
        { encoding: "utf8", env: process.env },
      );
    } catch (error) {
      if (error.status === expectedStatus) return String(error.stdout);
      throw error;
    }
  }
  const planOutput = run();
  assert.match(planOutput, /dry-run/);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const plan = JSON.parse(readFileSync(file, "utf8"));
  assert.ok(plan.checksum);
  assert.ok(plan.backups.some((row) => row.path === "settings/app"));
  assert.equal(
    (await db.doc("orders/migration-legacy").get()).data().storeId,
    undefined,
  );
  await db.doc("orders/migration-concurrent").update({ total: 999 });
  const first = JSON.parse(run(["--apply"], 2).trim().split("\n").at(-1));
  assert.ok(first.updated > 0);
  assert.ok(first.conflicts >= 1);
  assert.equal(
    (await db.doc("orders/migration-legacy").get()).data().storeId,
    "shopbeta",
  );
  assert.equal(
    (await db.doc("orders/migration-legacy").get()).data().total,
    123,
  );
  assert.equal(
    (await db.doc("orders/migration-explicit").get()).data().storeId,
    "zenvexa",
  );
  assert.equal(
    (await db.doc("orders/migration-cutoff").get()).data().storeId,
    undefined,
  );
  assert.equal(
    (await db.doc("orders/migration-ambiguous").get()).data().storeId,
    undefined,
  );
  assert.equal(
    (await db.doc("orders/migration-named").get()).data().storeId,
    "zenvexa",
  );
  assert.equal(
    (await db.doc("orders/migration-concurrent").get()).data().storeId,
    undefined,
  );
  assert.equal(
    (await db.doc("settings/ShopBeta").get()).data().paymentSecrets,
    undefined,
  );
  assert.equal(
    (
      await db.doc("privatePaymentSettings/shopbeta/providers/paystack").get()
    ).data().secretKey,
    "legacy-test-key",
  );
  assert.equal(
    (await db.doc("privatePaymentSettings/zenvexa/providers/paystack").get())
      .exists,
    false,
  );
  const second = JSON.parse(run(["--apply"], 2).trim().split("\n").at(-1));
  assert.equal(second.updated, 0);
  assert.ok(second.alreadyApplied > 0);
  const initialPlanFile = file;
  await db
    .doc("settings/app")
    .update({ "storeInformation.name": "ShopBeta Renamed" });
  await db
    .doc("privatePaymentSettings/squad")
    .update({ sandboxSecretKey: "rotated-before-cutover" });
  file = path.join(dir, "cutover.json");
  run(["--refresh-shopbeta"]);
  const refreshPlan = JSON.parse(readFileSync(file, "utf8"));
  assert.ok(refreshPlan.entries.some((entry) => entry.kind === "replace"));
  run(["--apply"]);
  assert.equal(
    (await db.doc("settings/ShopBeta").get()).data().storeInformation.name,
    "ShopBeta Renamed",
  );
  assert.equal(
    (
      await db.doc("privatePaymentSettings/shopbeta/providers/squad").get()
    ).data().sandboxSecretKey,
    "rotated-before-cutover",
  );
  run(["--rollback"]);
  file = initialPlanFile;
  const rollback = JSON.parse(run(["--rollback"]).trim().split("\n").at(-1));
  assert.ok(rollback.updated > 0);
  assert.equal(
    (await db.doc("orders/migration-legacy").get()).data().storeId,
    undefined,
  );
  assert.equal(
    (await db.doc("orders/migration-concurrent").get()).data().total,
    999,
  );
  assert.equal(
    (await db.doc("settings/app").get()).data().paymentSecrets
      .paystackSecretKey,
    "legacy-test-key",
  );
  const tampered = { ...plan, entries: [] };
  writeFileSync(file, JSON.stringify(tampered));
  assert.throws(() => run(["--apply"]), /Command failed/);
  console.log(
    "Migration emulator checks passed: backup permissions/checksum, dry run, cutoff, explicit attribution, conditional concurrent writes, rerun, rollback, tamper rejection.",
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
