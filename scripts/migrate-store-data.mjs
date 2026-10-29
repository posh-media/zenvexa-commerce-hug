import { createHash } from "node:crypto";
/** Private, resumable, optimistic migration. No writes occur without --apply or --rollback. */
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import {
  getFirestore,
  FieldPath,
  FieldValue,
  Timestamp,
  GeoPoint,
  DocumentReference,
} from "firebase-admin/firestore";
import { orderPatch, publicSettings } from "./store-migration-plan.mjs";
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const file = option("--file");
const projectId = option("--project");
if (!file || !projectId)
  throw new Error(
    "Use --project PROJECT_ID --file PRIVATE_PATH [--apply|--rollback]. Default creates a dry-run plan and backup.",
  );
if (args.includes("--apply") && args.includes("--rollback"))
  throw new Error("Choose apply OR rollback.");
let account = null;
try {
  account = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;
} catch {
  throw new Error(
    "FIREBASE_SERVICE_ACCOUNT must be valid JSON. Credential contents are not logged.",
  );
}
if (account?.project_id && account.project_id !== projectId)
  throw new Error("Credential project does not match --project.");
initializeApp({
  credential: account ? cert(account) : applicationDefault(),
  projectId,
});
const db = getFirestore();
const checksum = (plan) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        entries: plan.entries,
        backups: plan.backups,
        issues: plan.issues,
      }),
    )
    .digest("hex");

const encode = (value) => {
  if (value instanceof GeoPoint)
    return { $geopoint: [value.latitude, value.longitude] };
  if (value instanceof DocumentReference) return { $reference: value.path };
  if (Buffer.isBuffer(value)) return { $bytes: value.toString("base64") };
  if (value instanceof Timestamp)
    return { $timestamp: [value.seconds, value.nanoseconds] };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, encode(v)]),
    );
  return value;
};
const decode = (value) => {
  if (value?.$geopoint) return new GeoPoint(...value.$geopoint);
  if (value?.$reference) return db.doc(value.$reference);
  if (value?.$bytes) return Buffer.from(value.$bytes, "base64");
  if (value?.$timestamp) return new Timestamp(...value.$timestamp);
  if (value?.$date) return new Date(value.$date);
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, decode(v)]),
    );
  return value;
};
const save = async (path, data) => {
  await mkdir(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  await chmod(path, 0o600);
};
if (!args.includes("--apply") && !args.includes("--rollback")) {
  const plan = {
    version: 1,
    projectId,
    createdAt: new Date().toISOString(),
    cutoff: "2026-10-28T00:00:00Z",
    backups: [],
    entries: [],
    issues: [],
    counts: { orders: 0, ambiguous: 0, skipped: 0 },
  };
  async function backup(path) {
    const snap = await db.doc(path).get();
    const row = {
      path,
      exists: snap.exists,
      before: encode(snap.data() || {}),
      updateTime: encode(snap.updateTime),
    };
    plan.backups.push(row);
    return snap;
  }
  async function create(path, data, sources = []) {
    const snap = await backup(path);
    if (!snap.exists)
      plan.entries.push({ path, kind: "create", after: encode(data), sources });
    else if (
      args.includes("--refresh-shopbeta") &&
      (path === "settings/ShopBeta" ||
        path.startsWith("privatePaymentSettings/shopbeta/providers/"))
    )
      plan.entries.push({
        path,
        kind: "replace",
        after: encode(data),
        sources,
      });
  }
  const legacy = (await backup("settings/app")).data() || {};
  await create(
    "settings/ShopBeta",
    publicSettings(
      legacy,
      "shopbeta",
      legacy.storeInformation?.name?.trim() ||
        legacy.storeName?.trim() ||
        "ShopBeta",
    ),
    ["settings/app"],
  );
  // No ShopBeta tax/contact/payment/credential configuration is silently inherited by Zenvexa.
  await create("settings/Zenvexa", {
    storeId: "zenvexa",
    storeInformation: { name: "Zenvexa" },
    payments: {
      paystackEnabled: false,
      korapayEnabled: false,
      squadEnabled: false,
      monnifyEnabled: false,
      bachsEnabled: false,
      flutterwaveEnabled: false,
      codEnabled: false,
    },
  });
  for (const provider of [
    "paystack",
    "korapay",
    "flutterwave",
    "squad",
    "monnify",
    "bachs",
  ]) {
    const source =
      (await backup(`privatePaymentSettings/${provider}`)).data() || {};
    const legacyKey = legacy.paymentSecrets?.[`${provider}SecretKey`];
    if (!source.secretKey && legacyKey) source.secretKey = legacyKey;
    if (Object.keys(source).length)
      await create(
        `privatePaymentSettings/shopbeta/providers/${provider}`,
        source,
        ["settings/app", `privatePaymentSettings/${provider}`],
      );
  }
  const integrations = Object.fromEntries(
    ["makeWebhookUrl", "transactionalEmailWebhookUrl"]
      .filter((k) => legacy.notifications?.[k])
      .map((k) => [k, legacy.notifications[k]]),
  );
  if (Object.keys(integrations).length)
    await create("privateStoreSettings/shopbeta", integrations, [
      "settings/app",
    ]);
  let cursor;
  while (true) {
    let query = db
      .collection("orders")
      .orderBy(FieldPath.documentId())
      .limit(250);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const snap of page.docs) {
      plan.counts.orders++;
      const result = orderPatch(snap.data());
      if (result.patch) {
        const row = {
          path: snap.ref.path,
          exists: true,
          before: encode(snap.data()),
          updateTime: encode(snap.updateTime),
        };
        plan.backups.push(row);
        plan.entries.push({
          path: snap.ref.path,
          kind: "patch",
          after: result.patch,
        });
      } else if (result.reason.startsWith("ambiguous")) {
        plan.counts.ambiguous++;
        plan.issues.push({ path: snap.ref.path, reason: result.reason });
      } else plan.counts.skipped++;
    }
    cursor = page.docs.at(-1);
    if (page.size < 250) break;
  }
  plan.checksum = checksum(plan);
  await save(file, plan);
  // Verify durable bytes parse before reporting success; private backup includes secrets and customer records.
  const verified = JSON.parse(await readFile(file, "utf8"));
  if (verified.entries.length !== plan.entries.length)
    throw new Error("Backup verification failed.");
  console.log(
    JSON.stringify({
      mode: "dry-run",
      projectId,
      privateBackup: resolve(file),
      entries: plan.entries.length,
      ...plan.counts,
    }),
  );
} else {
  const plan = JSON.parse(await readFile(file, "utf8"));
  if (
    plan.projectId !== projectId ||
    plan.version !== 1 ||
    plan.checksum !== checksum(plan)
  )
    throw new Error("Plan project/version mismatch.");
  const before = new Map(plan.backups.map((row) => [row.path, row]));
  const rollback = args.includes("--rollback");
  const report = {
    mode: rollback ? "rollback" : "apply",
    updated: 0,
    alreadyApplied: 0,
    conflicts: 0,
    failed: 0,
    notApplied: 0,
  };
  for (const entry of plan.entries) {
    try {
      const result = await db.runTransaction(async (tx) => {
        const ref = db.doc(entry.path);
        const snap = await tx.get(ref);
        const receiptRef = db
          .collection("storeMigrationReceipts")
          .doc(plan.checksum)
          .collection("entries")
          .doc(createHash("sha256").update(entry.path).digest("hex"));
        const receipt = await tx.get(receiptRef);
        const data = snap.data() || {};
        const after = decode(entry.after);
        const backup = before.get(entry.path);
        const matches =
          snap.exists &&
          Object.entries(after).every(
            ([key, value]) =>
              JSON.stringify(encode(data[key])) ===
              JSON.stringify(encode(value)),
          );
        if (rollback) {
          if (!receipt.exists) return "notApplied";
          if (!matches) {
            return "conflicts";
          }
          if (entry.kind === "create") {
            // Never delete a configuration document changed since migration.
            if (JSON.stringify(encode(data)) !== JSON.stringify(entry.after)) {
              return "conflicts";
            }
            tx.delete(ref);
          } else if (entry.kind === "replace") {
            if (JSON.stringify(encode(data)) !== JSON.stringify(entry.after))
              return "conflicts";
            tx.set(ref, decode(backup.before));
          } else {
            const original = decode(backup.before);
            tx.update(
              ref,
              Object.fromEntries(
                Object.keys(after).map((key) => [
                  key,
                  Object.hasOwn(original, key)
                    ? original[key]
                    : FieldValue.delete(),
                ]),
              ),
            );
          }
        } else {
          if (matches) {
            return "alreadyApplied";
          }
          for (const path of entry.sources || []) {
            const source = await tx.get(db.doc(path));
            const original = before.get(path);
            if (
              !original ||
              source.exists !== original.exists ||
              (source.exists &&
                !source.updateTime.isEqual(decode(original.updateTime)))
            )
              return "conflicts";
          }
          if (entry.kind === "create") {
            if (snap.exists) {
              return "conflicts";
            }
            tx.create(ref, after);
          } else {
            if (
              !snap.exists ||
              !snap.updateTime.isEqual(decode(backup.updateTime))
            ) {
              return "conflicts";
            }
            if (entry.kind === "replace") tx.set(ref, after);
            else tx.update(ref, after);
          }
        }
        if (rollback) tx.delete(receiptRef);
        else
          tx.create(receiptRef, {
            path: entry.path,
            planChecksum: plan.checksum,
            appliedAt: FieldValue.serverTimestamp(),
          });
        return "updated";
      });
      report[result]++;
    } catch {
      report.failed++;
    }
  }
  console.log(JSON.stringify(report));
  if (report.failed || report.conflicts) process.exitCode = 2;
}
