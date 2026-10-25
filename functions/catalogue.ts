import { createHash } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import type { Product } from "../src/lib/commerce";

type Data = Record<string, unknown>;
type RecordEntry = { path: string; data: Data };
export const catalogueHash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export const categoryKey = (name: string) =>
  createHash("sha256").update(name).digest("hex").slice(0, 24);
export function seedProducts(products: Product[]): Data[] {
  if (products.length !== 50) throw new Error("Expected all 50 Zenvexa mock products.");
  if (
    new Set(products.map((p) => p.id)).size !== 50 ||
    new Set(products.map((p) => p.sku.toUpperCase())).size !== 50
  )
    throw new Error("Duplicate catalogue IDs/SKUs.");
  return products.map((p) => {
    if (
      !p.title ||
      !p.description ||
      !p.sku ||
      !Number.isSafeInteger(p.price) ||
      p.price <= 0 ||
      !Number.isSafeInteger(p.stock) ||
      p.stock < 0
    )
      throw new Error(`Invalid source product ${p.id}`);
    const verified = p.id === "eco";
    const image = verified ? "/catalog/eco.webp" : "/catalog/missing.svg";
    const slug =
      p.title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 90) || p.id;
    return {
      ...p,
      slug,
      categoryId: categoryKey(p.category),
      shortDescription: "",
      currency: "NGN",
      active: true,
      featured: p.id === "eco",
      image,
      images: [image],
      originalImage: p.image,
      imageStatus: verified ? "verified" : "missing",
      imageNotes: verified
        ? "DELTA 2 manufacturer-page reference reviewed. Source and publication-rights caveat recorded in catalogue-image-sources.json."
        : "Exact product photograph not verified. Original reference retained for review.",
      reviewSource: "seed",
      source: "zenvexa-mock-catalogue",
      version: 1,
      seedVersion: 2,
      searchTokens: [
        ...new Set([
          p.id,
          p.sku.toLowerCase(),
          ...`${p.title} ${p.category}`
            .toLowerCase()
            .split(/\s+/)
            .flatMap((word) =>
              Array.from({ length: Math.min(word.length, 30) }, (_, i) => word.slice(0, i + 1)),
            ),
        ]),
      ].slice(0, 400),
    };
  });
}
export function planCatalogue(source: RecordEntry[], existing: RecordEntry[]) {
  const byPath = new Map(existing.map((r) => [r.path, r.data]));
  const skuOwners = new Map<string, string>();
  const issues: string[] = [];
  for (const record of existing.filter((r) => r.path.startsWith("products/"))) {
    const sku = String(record.data["sku"] ?? "").toUpperCase();
    if (sku && skuOwners.has(sku)) issues.push(`Duplicate existing SKU at ${record.path}`);
    if (sku) skuOwners.set(sku, record.path);
  }
  const changes = source.map((record) => {
    const current = byPath.get(record.path);
    const patch: Data = {};
    if (!current) {
      if (record.path.startsWith("products/")) {
        const owner = skuOwners.get(String(record.data["sku"]).toUpperCase());
        if (owner && owner !== record.path) issues.push(`SKU conflict at ${record.path}`);
      }
      return { ...record, action: "create", expected: null, fields: Object.keys(record.data) };
    }
    for (const [key, value] of Object.entries(record.data))
      if (current[key] === undefined || current[key] === null)
        patch[key] = key === "reviewSource" ? "unverified" : value;
    if (record.path.startsWith("products/")) {
      for (const key of ["title", "description", "sku", "category"])
        if (typeof current[key] !== "string" || !String(current[key]).trim())
          patch[key] = record.data[key];
      const allowed = source
        .filter((r) => r.path.startsWith("categories/"))
        .map((r) => r.data["name"]);
      if (!allowed.includes(current["category"])) {
        patch["category"] = record.data["category"];
        patch["categoryId"] = record.data["categoryId"];
      }
      if (!Array.isArray(current["specs"]) || !current["specs"].every((v) => typeof v === "string"))
        patch["specs"] = record.data["specs"];
      if (typeof current["image"] === "string" && current["image"].startsWith("data:"))
        issues.push(
          `Binary image at ${record.path} requires a reviewed Storage upload before repair.`,
        );
      if (!Number.isSafeInteger(current["price"]) || Number(current["price"]) <= 0)
        patch["price"] = record.data["price"];
      if (!Number.isSafeInteger(current["stock"]) || Number(current["stock"]) < 0) {
        patch["stock"] = 0;
        patch["active"] = false;
        patch["migrationNotes"] =
          "Invalid existing stock quarantined at zero; staff review required.";
      }
      const newPrice = Number(patch["price"] ?? current["price"]);
      if (!Number.isSafeInteger(current["oldPrice"]) || Number(current["oldPrice"]) < newPrice)
        patch["oldPrice"] = newPrice;
      if (
        current["image"] === record.data["originalImage"] &&
        record.data["image"] !== current["image"]
      ) {
        for (const key of ["image", "images", "imageStatus", "imageNotes"])
          patch[key] = record.data[key];
      }
      if (
        current["reviewSource"] === undefined &&
        current["rating"] === record.data["rating"] &&
        current["reviews"] === record.data["reviews"]
      )
        patch["reviewSource"] = "seed";
      const sku = String(patch["sku"] ?? current["sku"]).toUpperCase();
      const owner = skuOwners.get(sku);
      if (owner && owner !== record.path) issues.push(`SKU conflict at ${record.path}`);
    }
    if (current["createdAt"] === undefined) patch["createdAt"] = "__SERVER_TIMESTAMP__";
    if (current["updatedAt"] === undefined) patch["updatedAt"] = "__SERVER_TIMESTAMP__";
    return {
      path: record.path,
      data: patch,
      expected: catalogueHash(current),
      action: Object.keys(patch).length ? "repair" : "preserve",
      fields: Object.keys(patch),
    };
  });
  return {
    changes,
    issues,
    summary: {
      create: changes.filter((r) => r.action === "create").length,
      repair: changes.filter((r) => r.action === "repair").length,
      preserve: changes.filter((r) => r.action === "preserve").length,
      existingProducts: existing.filter((r) => r.path.startsWith("products/")).length,
      existingCategories: existing.filter((r) => r.path.startsWith("categories/")).length,
    },
  };
}
export async function catalogueMigration(
  source: RecordEntry[],
  mode: "dry-run" | "apply",
  approvedHash?: string,
) {
  if (process.env["FIRESTORE_EMULATOR_HOST"])
    throw new Error(
      "Remote migration refuses emulator configuration. Use the separate emulator seed.",
    );
  if (process.env["ZENVEXA_REMOTE_SEED_PROJECT"] !== "zenvexa-c8d84")
    throw new Error("Explicit ZENVEXA_REMOTE_SEED_PROJECT=zenvexa-c8d84 is required.");
  const app = initializeApp({ projectId: "zenvexa-c8d84" }, "catalogue-migration");
  const db = getFirestore(app);
  try {
    const existing: RecordEntry[] = [];
    for (const name of ["products", "categories", "deliveryZones"]) {
      const count = await db.collection(name).count().get();
      if (count.data().count > 5000) throw new Error("Catalogue exceeds reviewed migration bound.");
      const snap = await db.collection(name).get();
      existing.push(...snap.docs.map((d) => ({ path: d.ref.path, data: d.data() })));
    }
    const plan = planCatalogue(source, existing);
    const hash = catalogueHash({ source, existing });
    const artifactDir = process.env["ZENVEXA_MIGRATION_ARTIFACT_DIR"] ?? "catalogue-migration";
    await mkdir(artifactDir, { recursive: true });
    if (mode === "dry-run") {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await writeFile(
        `${artifactDir}/backup-${stamp}.json`,
        JSON.stringify(
          { projectId: "zenvexa-c8d84", createdAt: stamp, records: existing },
          null,
          2,
        ),
      );
      await writeFile(
        `${artifactDir}/plan.json`,
        JSON.stringify({ projectId: "zenvexa-c8d84", hash, ...plan }, null, 2),
      );
      console.log(
        JSON.stringify(
          {
            projectId: "zenvexa-c8d84",
            hash,
            ...plan.summary,
            issues: plan.issues,
            changes: plan.changes.map((r) => ({
              path: r.path,
              action: r.action,
              fields: r.fields,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }
    if (!approvedHash || hash !== approvedHash || plan.issues.length)
      throw new Error(
        "Approved dry-run hash no longer matches, or unresolved conflicts exist. No writes performed.",
      );
    const backup = JSON.parse(await readFile(`${artifactDir}/plan.json`, "utf8")) as {
      hash: string;
    };
    if (backup.hash !== hash) throw new Error("Persisted dry-run approval does not match.");
    const changes = plan.changes.filter((r) => r.action !== "preserve");
    if (changes.length > 200) throw new Error("Migration exceeds reviewed write bound.");
    await db.runTransaction(async (tx) => {
      const current: RecordEntry[] = [];
      for (const name of ["products", "categories", "deliveryZones"]) {
        const snap = await tx.get(db.collection(name));
        current.push(...snap.docs.map((d) => ({ path: d.ref.path, data: d.data() })));
      }
      if (catalogueHash({ source, existing: current }) !== hash)
        throw new Error("Catalogue changed after dry-run. Aborting without writes.");
      for (const change of changes) {
        const ref = db.doc(change.path);
        const data = {
          ...Object.fromEntries(
            Object.entries(change.data).map(([key, value]) => [
              key,
              value === "__SERVER_TIMESTAMP__" ? FieldValue.serverTimestamp() : value,
            ]),
          ),
          updatedAt: FieldValue.serverTimestamp(),
          ...(change.action === "create" ? { createdAt: FieldValue.serverTimestamp() } : {}),
        };
        if (change.action === "create") tx.create(ref, data);
        else tx.set(ref, data, { merge: true });
      }
    });
    const verified = await db.collection("products").get();
    const ids = new Set(verified.docs.map((d) => d.id));
    if (
      source
        .filter((r) => r.path.startsWith("products/"))
        .some((r) => !ids.has(r.path.split("/")[1]!))
    )
      throw new Error(
        "Post-write verification incomplete. Inspect saved backup and database; do not rerun blindly.",
      );
    console.log(
      JSON.stringify({
        projectId: "zenvexa-c8d84",
        verifiedProductCount: verified.size,
        verifiedSeedProductIds: 50,
        changedDocuments: changes.length,
      }),
    );
  } finally {
    await deleteApp(app);
  }
}
