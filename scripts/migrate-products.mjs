#!/usr/bin/env node
/**
 * Additive migration for the `products` collection.
 *
 * Dry-run by default: it prints the patch it would apply and writes nothing.
 * Pass --apply to write. The migration is idempotent and only ever *adds*
 * missing fields — existing values and legacy fields are never touched.
 *
 * Usage:
 *   node scripts/migrate-products.mjs                       # dry run
 *   node scripts/migrate-products.mjs --apply               # write
 *   node scripts/migrate-products.mjs --credentials=key.json
 *   node scripts/migrate-products.mjs --default-stock=25    # optional; default stock is 0
 *
 * Credentials are resolved from --credentials, GOOGLE_APPLICATION_CREDENTIALS
 * or FIREBASE_SERVICE_ACCOUNT (raw JSON).
 */
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore, parseArgs } from "./lib/admin.mjs";

const { flag, option } = parseArgs();

const APPLY = flag("apply");
const DEFAULT_STOCK = Number(option("default-stock") ?? 0);
const COLLECTION = option("collection") ?? "products";

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Uppercase alphanumeric barcode consistent with the SB-* sku family. */
function barcodeFor(id) {
  return `SB-${String(id).replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`;
}

/** "Label: value" lines -> [{ label, value }], original field left in place. */
function parseSpecifications(specification) {
  if (typeof specification !== "string") return [];
  return specification
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return { label: line, value: "" };
      return {
        label: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
      };
    })
    .filter((entry) => entry.value.length > 0);
}

/** `variation: string[]` -> structured variant options. */
function toVariants(variation) {
  if (!Array.isArray(variation)) return [];
  return variation
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => ({ label: "Variant", value: value.trim() }));
}

function has(data, field) {
  return data[field] !== undefined && data[field] !== null;
}

function uniqueSlug(base, taken) {
  const seed = base || "product";
  let candidate = seed;
  let suffix = 2;
  while (taken.has(candidate)) {
    candidate = `${seed}-${suffix}`;
    suffix += 1;
  }
  taken.add(candidate);
  return candidate;
}

function stockStatusFromCount(stock) {
  if (stock == null || stock <= 0) return "out_of_stock";
  if (stock <= 5) return "low_stock";
  return "in_stock";
}

function buildSearchKeywords(data) {
  const words = new Set();
  for (const value of [
    data.productName,
    data.brand,
    data.category,
    data.sku,
    data.barcode,
  ]) {
    if (typeof value !== "string" || !value.trim()) continue;
    for (const token of value.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length > 2) words.add(token);
    }
  }
  if (Array.isArray(data.keywords)) {
    for (const keyword of data.keywords) {
      if (typeof keyword === "string" && keyword.trim()) words.add(keyword.toLowerCase());
    }
  }
  return [...words];
}

function buildPatch(id, data, takenSlugs, now) {
  const patch = {};
  const set = (field, value) => {
    if (!has(data, field) && value !== undefined) patch[field] = value;
  };

  const images = Array.isArray(data.images)
    ? data.images
    : Array.isArray(data.imgs)
      ? data.imgs
      : [];
  const reviews = Array.isArray(data.reviews) ? data.reviews : [];
  const specifications = parseSpecifications(data.specification);
  const variants = toVariants(data.variation);
  const name = typeof data.productName === "string" ? data.productName : id;
  const description =
    typeof data.description === "string" ? data.description : "";
  const stock = has(data, "stock") ? Number(data.stock) : DEFAULT_STOCK;
  const searchKeywords = buildSearchKeywords(data);

  set("slug", uniqueSlug(slugify(data.productName ?? id), takenSlugs));
  set("sku", `SB-${String(id).toUpperCase()}`);
  set("barcode", barcodeFor(id));
  if (images.length) {
    set("images", images);
    set("thumbnail", images[0]);
  }
  set("stock", DEFAULT_STOCK);
  set("stockStatus", stockStatusFromCount(stock));
  set("currency", "NGN");
  set("reviewCount", reviews.length);
  if (specifications.length) set("specifications", specifications);
  if (variants.length) set("variants", variants);
  if (typeof data.category === "string" && data.category.trim()) {
    set("categoryId", slugify(data.category));
  }
  // `officialStore` mirrors the legacy `officalStore`; the typo field is kept.
  if (!has(data, "officialStore") && has(data, "officalStore")) {
    patch.officialStore = Boolean(data.officalStore);
  }
  set("tags", []);
  set("featured", false);
  set("trending", false);
  set("flashSale", false);
  set("bestSeller", false);
  set("active", true);
  set("seoTitle", name);
  set("seoDescription", description ? description.slice(0, 160) : `${name} on ShopBeta`);
  set("seoKeywords", searchKeywords);
  set("searchKeywords", searchKeywords);
  set("viewCount", 0);
  set("salesCount", 0);
  set("wishlistCount", 0);
  set("createdAt", now);
  set("updatedAt", now);

  return patch;
}

function preview(value) {
  const text = JSON.stringify(value, (_key, item) =>
    item instanceof Timestamp ? item.toDate().toISOString() : item,
  );
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

async function main() {
  const db = getAdminFirestore(option("credentials"));
  const snapshot = await db.collection(COLLECTION).get();
  const now = Timestamp.now();

  const takenSlugs = new Set(
    snapshot.docs
      .map((document) => document.get("slug"))
      .filter((slug) => typeof slug === "string" && slug.length > 0),
  );

  console.log(
    `${APPLY ? "APPLY" : "DRY RUN"} — ${snapshot.size} document(s) in "${COLLECTION}", default stock ${DEFAULT_STOCK}\n`,
  );
  if (!Number.isFinite(DEFAULT_STOCK)) {
    throw new Error(`Invalid --default-stock value: ${option("default-stock")}`);
  }

  let changed = 0;
  for (const document of snapshot.docs) {
    const patch = buildPatch(document.id, document.data(), takenSlugs, now);
    const fields = Object.keys(patch);
    if (!fields.length) {
      console.log(`· ${document.id}: already migrated, nothing to add`);
      continue;
    }
    changed += 1;
    console.log(`+ ${document.id}: adding ${fields.join(", ")}`);
    console.log(`  ${preview(patch)}`);
    // `update` only touches the listed fields; nothing else is rewritten.
    if (APPLY) await document.ref.update(patch);
  }

  console.log(
    `\n${changed} of ${snapshot.size} document(s) ${APPLY ? "updated" : "would be updated"}.`,
  );
  if (!APPLY && changed) console.log("Re-run with --apply to write these changes.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
