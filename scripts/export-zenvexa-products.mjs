import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");

const projectId = option("project") ?? "zenvexa-c8d84";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.resolve(
  root,
  option("out") ?? `migration-review/zenvexa-firebase-backup-${stamp}`,
);
const collections = ["products", "categories", "brands"];

function serializeValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value !== "object") return value;
  if (typeof value.toDate === "function" && "seconds" in value && "nanoseconds" in value) {
    return {
      _type: "Timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }
  if (typeof value.path === "string" && typeof value.id === "string") {
    return { _type: "DocumentReference", path: value.path };
  }
  if ("latitude" in value && "longitude" in value) {
    return {
      _type: "GeoPoint",
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return { _type: "Bytes", base64: Buffer.from(value).toString("base64") };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serializeValue(item)]),
  );
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const checksum = (value) => createHash("sha256").update(value).digest("hex");

const app = initializeApp({ projectId }, "zenvexa-catalog-backup");
const db = getFirestore(app);
mkdirSync(outDir, { recursive: true });

const manifest = {
  kind: "zenvexa-firebase-catalog-backup",
  sourceProjectId: projectId,
  exportedAt: new Date().toISOString(),
  collections: {},
};

for (const name of collections) {
  const snapshot = await db.collection(name).get();
  const records = snapshot.docs.map((document) => ({
    id: document.id,
    data: serializeValue(document.data()),
  }));
  const fieldUnion = [
    ...new Set(records.flatMap((record) => Object.keys(record.data))),
  ].sort();
  const payload = {
    projectId,
    collection: name,
    recordCount: records.length,
    records,
  };
  const canonical = stable(payload);
  const file = `${name}.json`;
  writeFileSync(path.join(outDir, file), `${JSON.stringify(payload, null, 2)}\n`);
  manifest.collections[name] = {
    file,
    recordCount: records.length,
    fieldUnion,
    checksumSha256: checksum(canonical),
  };
}

writeFileSync(
  path.join(outDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const saved = JSON.parse(readFileSync(path.join(outDir, "manifest.json"), "utf8"));
for (const [name, meta] of Object.entries(saved.collections)) {
  const payload = JSON.parse(readFileSync(path.join(outDir, meta.file), "utf8"));
  if (payload.recordCount !== meta.recordCount || payload.records.length !== meta.recordCount) {
    throw new Error(`Backup verification failed for ${name}.`);
  }
  if (checksum(stable(payload)) !== meta.checksumSha256) {
    throw new Error(`Checksum verification failed for ${name}.`);
  }
}

console.log(
  JSON.stringify(
    {
      status: "verified",
      backupDirectory: outDir,
      projectId,
      collections: Object.fromEntries(
        Object.entries(manifest.collections).map(([name, meta]) => [
          name,
          meta.recordCount,
        ]),
      ),
    },
    null,
    2,
  ),
);
