import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const option = (name) =>
  process.argv
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
const flag = (name) => process.argv.includes(`--${name}`);

const projectId = option("project") ?? "shop-day84j";
const latestBackup = readdirSync(path.join(root, "migration-review"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("zenvexa-firebase-backup-"))
  .map((entry) => entry.name)
  .sort()
  .at(-1);
const backupDir = option("backup")
  ? path.resolve(root, option("backup"))
  : path.join(root, "migration-review", latestBackup ?? "");
const apply = flag("apply");
const rollback = flag("rollback");
const reportPath = path.resolve(
  root,
  option("report") ??
    path.join(
      "migration-review",
      `zenvexa-shopbeta-migration-${rollback ? "rollback-" : ""}${Date.now()}.json`,
    ),
);

function loadJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function loadCredentials() {
  const credentialsPath = option("credentials") ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const credentials = credentialsPath
    ? JSON.parse(readFileSync(credentialsPath, "utf8"))
    : raw
      ? JSON.parse(raw)
      : undefined;
  if (!credentials) {
    throw new Error(
      "ShopBeta Admin credentials are required. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS, or pass --credentials=<path>.",
    );
  }
  if (credentials.project_id && credentials.project_id !== projectId) {
    throw new Error(
      `Credential project mismatch: expected ${projectId}; refusing to use a service account for ${credentials.project_id}.`,
    );
  }
  return credentials;
}

function deserialize(value) {
  if (Array.isArray(value)) return value.map(deserialize);
  if (!value || typeof value !== "object") return value;
  if (value._type === "Timestamp") {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, deserialize(item)]),
  );
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stockStatus(stock) {
  if (!Number.isFinite(stock) || stock <= 0) return "out_of_stock";
  if (stock <= 5) return "low_stock";
  return "in_stock";
}

function text(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function number(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function usableImages(source) {
  const candidates = [
    ...(Array.isArray(source.images) ? source.images : []),
    source.image,
    source.thumbnail,
  ];
  return [
    ...new Set(
      candidates
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim())
        .filter((value) => !/missing\.svg|placeholder|no-image/i.test(value)),
    ),
  ];
}

function keywords(source, productName, categoryName, brandName) {
  const words = new Set(
    Array.isArray(source.searchTokens)
      ? source.searchTokens.filter((item) => typeof item === "string" && item.trim())
      : [],
  );
  for (const value of [productName, brandName, categoryName, source.sku]) {
    if (typeof value !== "string") continue;
    for (const token of value.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length > 2) words.add(token);
    }
  }
  return [...words].sort();
}

function stable(value) {
  if (value instanceof Timestamp) {
    return `Timestamp(${value.seconds}.${value.nanoseconds})`;
  }
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const checksum = (value) => createHash("sha256").update(stable(value)).digest("hex");

function refIndex(docs, names = []) {
  const map = new Map();
  for (const document of docs) {
    const data = document.data();
    for (const value of [document.id, data.slug, data.name, ...names.map((name) => data[name])]) {
      const key = slugify(value);
      if (key) map.set(key, document.id);
    }
  }
  return map;
}

function sameDocumentId(existing, sourceId, sourceProjectId) {
  const marker = existing?.zenvexaMigration;
  return marker?.sourceDocumentId === sourceId && marker?.sourceProjectId === sourceProjectId;
}

function stripVolatile(data) {
  const clone = { ...data };
  delete clone.zenvexaMigration;
  return clone;
}

function mappedProduct(source, context) {
  const sourceId = text(source.id);
  const productName = text(source.title, sourceId);
  const categoryName = text(source.category, "Uncategorised");
  const brandName = text(source.vendor) || undefined;
  const images = usableImages(source);
  const price = number(source.price);
  const oldPrice = number(source.oldPrice);
  const discount =
    oldPrice > price && oldPrice > 0
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : number(source.discount);
  const stock = number(source.stock);
  const specs = Array.isArray(source.specs)
    ? source.specs.filter((item) => typeof item === "string" && item.trim())
    : [];
  const categoryId = context.categories.get(slugify(categoryName));
  const brandId = brandName ? context.brands.get(slugify(brandName)) : undefined;
  const sourceSlug = text(source.slug, slugify(productName));
  const sku = text(source.sku);
  const destinationId = `zvx-${sourceId}`;
  const tags = [
    ...(source.featured === true ? ["featured"] : []),
    ...(discount > 0 ? ["special-offer"] : []),
  ];
  const description = text(source.description, text(source.shortDescription));
  const data = {
    productName,
    description,
    specification: specs.join("\n"),
    price,
    discount,
    currency: text(source.currency, "NGN"),
    rating: number(source.rating),
    reviewCount: number(source.reviews),
    images,
    imgs: images,
    slug: sourceSlug,
    sku,
    barcode: sku,
    brand: brandName,
    category: categoryName,
    stock,
    stockStatus: stockStatus(stock),
    specifications: specs.map((value) => ({ label: "Feature", value })),
    variants: [],
    variation: [],
    tags,
    featured: source.featured === true,
    trending: false,
    flashSale: false,
    bestSeller: false,
    sponsored: false,
    officialStore: false,
    active: source.active !== false,
    seoTitle: productName,
    seoDescription: description.slice(0, 160) || `${productName} on Zenvexa`,
    seoKeywords: keywords(source, productName, categoryName, brandName),
    searchKeywords: keywords(source, productName, categoryName, brandName),
    viewCount: 0,
    salesCount: 0,
    wishlistCount: 0,
    createdAt: source.createdAt ?? Timestamp.now(),
    updatedAt: source.updatedAt ?? source.createdAt ?? Timestamp.now(),
    zenvexaSource: {
      projectId: context.sourceProjectId,
      documentId: sourceId,
      categoryId: text(source.categoryId),
      image: text(source.image),
      images: Array.isArray(source.images) ? source.images : [],
      originalImage: text(source.originalImage),
      imageStatus: text(source.imageStatus),
      imageNotes: text(source.imageNotes),
      badge: text(source.badge),
      source: text(source.source),
      reviewSource: text(source.reviewSource),
      version: number(source.version),
      seedVersion: number(source.seedVersion),
      vendor: text(source.vendor),
    },
    zenvexaMigration: {
      sourceProjectId: context.sourceProjectId,
      sourceDocumentId: sourceId,
      batchId: context.batchId,
    },
  };
  if (images[0]) data.thumbnail = images[0];
  if (categoryId) data.categoryId = categoryId;
  if (brandId) data.brandId = brandId;
  return { destinationId, data, categoryId, brandId, sourceSlug, sku };
}

if (!existsSync(backupDir)) {
  throw new Error(`Backup directory not found: ${backupDir}`);
}
const manifest = loadJson(path.join(backupDir, "manifest.json"));
const sourceProjectId = manifest.sourceProjectId;
if (sourceProjectId !== "zenvexa-c8d84") {
  throw new Error(`Unexpected source project in backup: ${sourceProjectId}`);
}
const sourceProducts = loadJson(path.join(backupDir, "products.json")).records.map((record) =>
  deserialize(record.data),
);
const batchId = `zvx-${manifest.exportedAt.replace(/[^0-9A-Za-z]+/g, "-")}`;

const credentials = loadCredentials();
const app = initializeApp(
  { credential: cert(credentials), projectId },
  `zenvexa-shopbeta-migration-${Date.now()}`,
);
const db = getFirestore(app);

const [productsSnapshot, categoriesSnapshot, brandsSnapshot] = await Promise.all([
  db.collection("products").get(),
  db.collection("categories").get(),
  db.collection("brands").get(),
]);

const context = {
  sourceProjectId,
  batchId,
  categories: refIndex(categoriesSnapshot.docs),
  brands: refIndex(brandsSnapshot.docs),
};
const existingById = new Map(productsSnapshot.docs.map((document) => [document.id, document.data()]));
const existingBySlug = new Map();
const existingBySku = new Map();
for (const document of productsSnapshot.docs) {
  const data = document.data();
  if (data.slug) existingBySlug.set(data.slug, document.id);
  if (data.sku) existingBySku.set(data.sku, document.id);
}

const plan = {
  mode: rollback ? (apply ? "rollback" : "rollback-dry-run") : apply ? "apply" : "dry-run",
  sourceProjectId,
  destinationProjectId: projectId,
  backupDirectory: backupDir,
  batchId,
  counts: {
    sourceProducts: sourceProducts.length,
    destinationProductsBefore: productsSnapshot.size,
    create: 0,
    update: 0,
    unchanged: 0,
    skipped: 0,
    conflicts: 0,
    rollbackDelete: 0,
  },
  conflicts: [],
  unresolvedReferences: [],
  writes: [],
  verification: {},
};

if (rollback) {
  const rollbackDocs = productsSnapshot.docs.filter((document) => {
    const marker = document.data().zenvexaMigration;
    return marker?.sourceProjectId === sourceProjectId && marker?.batchId === batchId;
  });
  plan.counts.rollbackDelete = rollbackDocs.length;
  for (const document of rollbackDocs) {
    const batch = db.batch();
    batch.delete(document.ref);
    if (apply) await batch.commit();
    plan.writes.push({ action: "delete", id: document.id, sourceId: document.data().zenvexaMigration?.sourceDocumentId });
  }
} else {
  const writeBatch = db.batch();
  let writes = 0;
  for (const source of sourceProducts) {
    const mapped = mappedProduct(source, context);
    const existing = existingById.get(mapped.destinationId);
    const conflict = [];
    if (existing && !sameDocumentId(existing, source.id, sourceProjectId)) {
      conflict.push("document-id");
    }
    const slugOwner = existingBySlug.get(mapped.sourceSlug);
    if (slugOwner && slugOwner !== mapped.destinationId) conflict.push("slug");
    const skuOwner = mapped.sku ? existingBySku.get(mapped.sku) : undefined;
    if (skuOwner && skuOwner !== mapped.destinationId) conflict.push("sku");
    if (conflict.length) {
      plan.counts.conflicts += 1;
      plan.counts.skipped += 1;
      plan.conflicts.push({ sourceId: source.id, destinationId: mapped.destinationId, types: conflict });
      continue;
    }
    if (!mapped.categoryId) {
      plan.unresolvedReferences.push({ sourceId: source.id, type: "category", value: source.category ?? null });
    }
    if (source.vendor && !mapped.brandId) {
      plan.unresolvedReferences.push({ sourceId: source.id, type: "brand", value: source.vendor });
    }
    const incoming = stripVolatile(mapped.data);
    if (!existing) {
      plan.counts.create += 1;
      plan.writes.push({ action: "create", id: mapped.destinationId, sourceId: source.id });
      writeBatch.set(mapped.destinationId ? db.doc(`products/${mapped.destinationId}`) : undefined, {
        ...mapped.data,
        zenvexaMigration: {
          ...mapped.data.zenvexaMigration,
          checksum: checksum(incoming),
          importedAt: FieldValue.serverTimestamp(),
        },
      });
      writes += 1;
      continue;
    }
    const existingChecksum = existing.zenvexaMigration?.checksum;
    if (existingChecksum === checksum(incoming)) {
      plan.counts.unchanged += 1;
      continue;
    }
    plan.counts.update += 1;
    plan.writes.push({ action: "update", id: mapped.destinationId, sourceId: source.id });
    writeBatch.set(db.doc(`products/${mapped.destinationId}`), {
      ...mapped.data,
      zenvexaMigration: {
        ...mapped.data.zenvexaMigration,
        checksum: checksum(incoming),
        importedAt: existing.zenvexaMigration.importedAt ?? FieldValue.serverTimestamp(),
      },
    });
    writes += 1;
  }
  if (apply && writes) await writeBatch.commit();
}

if (apply) {
  const migrated = await db
    .collection("products")
    .where("zenvexaMigration.sourceProjectId", "==", sourceProjectId)
    .where("zenvexaMigration.batchId", "==", batchId)
    .get();
  plan.verification = {
    migratedDocuments: migrated.size,
    sourceIds: migrated.docs.map((document) => document.data().zenvexaMigration?.sourceDocumentId).sort(),
  };
}

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(plan, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      status: apply ? "applied" : "dry-run",
      report: reportPath,
      counts: plan.counts,
      conflicts: plan.conflicts.length,
      unresolvedReferences: plan.unresolvedReferences.length,
    },
    null,
    2,
  ),
);
