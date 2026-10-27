import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp as initializeClientApp } from "firebase/app";
import { collection, getDocs, getFirestore as getClientFirestore } from "firebase/firestore";
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
const publicDryRun = flag("public-dry-run");
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
const sourceCategories = loadJson(path.join(backupDir, "categories.json")).records.map((record) => ({
  id: record.id,
  ...deserialize(record.data),
}));
const batchId = `zvx-${manifest.exportedAt.replace(/[^0-9A-Za-z]+/g, "-")}`;

if (publicDryRun && (apply || rollback)) {
  throw new Error("--public-dry-run cannot be combined with --apply or --rollback.");
}

let db;
let productsSnapshot;
let categoriesSnapshot;
let brandsSnapshot;

if (publicDryRun) {
  const required = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing public Firebase environment variables: ${missing.join(", ")}`);
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== projectId) {
    throw new Error(
      `Public config project mismatch: expected ${projectId}; refusing to inspect ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.`,
    );
  }
  const clientApp = initializeClientApp(
    {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    },
    `zenvexa-shopbeta-public-dry-run-${Date.now()}`,
  );
  const clientDb = getClientFirestore(clientApp);
  [productsSnapshot, categoriesSnapshot, brandsSnapshot] = await Promise.all([
    getDocs(collection(clientDb, "products")),
    getDocs(collection(clientDb, "categories")),
    getDocs(collection(clientDb, "brands")),
  ]);
} else {
  const credentials = loadCredentials();
  const app = initializeApp(
    { credential: cert(credentials), projectId },
    `zenvexa-shopbeta-migration-${Date.now()}`,
  );
  db = getFirestore(app);
  [productsSnapshot, categoriesSnapshot, brandsSnapshot] = await Promise.all([
    db.collection("products").get(),
    db.collection("categories").get(),
    db.collection("brands").get(),
  ]);
}

const context = {
  sourceProjectId,
  batchId,
  categories: refIndex(categoriesSnapshot.docs),
  brands: refIndex(brandsSnapshot.docs),
};
const existingById = new Map(productsSnapshot.docs.map((document) => [document.id, document.data()]));
const existingCategoriesById = new Map(
  categoriesSnapshot.docs.map((document) => [document.id, document.data()]),
);
const existingBrandsById = new Map(
  brandsSnapshot.docs.map((document) => [document.id, document.data()]),
);
const existingBySlug = new Map();
const existingBySku = new Map();
for (const document of productsSnapshot.docs) {
  const data = document.data();
  if (data.slug) existingBySlug.set(data.slug, document.id);
  if (data.sku) existingBySku.set(data.sku, document.id);
}

const plan = {
  mode: publicDryRun
    ? "public-dry-run"
    : rollback
      ? (apply ? "rollback" : "rollback-dry-run")
      : apply
        ? "apply"
        : "dry-run",
  sourceProjectId,
  destinationProjectId: projectId,
  backupDirectory: backupDir,
  batchId,
  counts: {
    sourceProducts: sourceProducts.length,
    destinationProductsBefore: productsSnapshot.size,
    categoriesCreate: 0,
    brandsCreate: 0,
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
  const rollbackDocs = [
    ...productsSnapshot.docs.map((document) => ({ collection: "products", document })),
    ...categoriesSnapshot.docs.map((document) => ({ collection: "categories", document })),
    ...brandsSnapshot.docs.map((document) => ({ collection: "brands", document })),
  ].filter(({ document }) => {
    const marker = document.data().zenvexaMigration;
    return marker?.sourceProjectId === sourceProjectId && marker?.batchId === batchId;
  });
  plan.counts.rollbackDelete = rollbackDocs.length;
  for (const { collection: collectionName, document } of rollbackDocs) {
    const batch = db.batch();
    batch.delete(document.ref);
    if (apply) await batch.commit();
    plan.writes.push({
      action: "delete",
      collection: collectionName,
      id: document.id,
      sourceId: document.data().zenvexaMigration?.sourceDocumentId,
    });
  }
} else {
  const writeBatch = publicDryRun ? undefined : db.batch();
  const supportingWrites = [];
  let writes = 0;

  for (const category of sourceCategories) {
    const name = text(category.name);
    const slug = slugify(name);
    if (!name || context.categories.has(slug)) continue;
    const destinationId = `zvx-category-${slug}`;
    const existing = existingCategoriesById.get(destinationId);
    if (existing && !sameDocumentId(existing, category.id, sourceProjectId)) {
      plan.counts.conflicts += 1;
      plan.conflicts.push({ sourceId: category.id, destinationId, types: ["category-document-id"] });
      continue;
    }
    const image = usableImages({ images: [category.image] })[0];
    const data = {
      name,
      slug,
      description: text(category.description, `Shop ${name} on Zenvexa.`),
      ...(image ? { image } : {}),
      parentId: null,
      subcategories: [],
      productCount: sourceProducts.filter((product) => product.category === name).length,
      featured: category.featured === true,
      active: true,
      seoTitle: name,
      seoDescription: text(category.description, `Shop ${name} on Zenvexa.`),
      createdAt: category.createdAt ?? Timestamp.now(),
      updatedAt: category.updatedAt ?? Timestamp.now(),
      zenvexaSource: {
        projectId: sourceProjectId,
        documentId: category.id,
      },
      zenvexaMigration: {
        sourceProjectId,
        sourceDocumentId: category.id,
        batchId,
      },
    };
    supportingWrites.push({ collection: "categories", id: destinationId, sourceId: category.id, data });
    context.categories.set(slug, destinationId);
    plan.counts.categoriesCreate += 1;
    plan.writes.push({ action: "create", collection: "categories", id: destinationId, sourceId: category.id });
  }

  const sourceBrands = new Map();
  for (const product of sourceProducts) {
    const name = text(product.vendor);
    if (!name) continue;
    const slug = slugify(name);
    const existing = sourceBrands.get(slug) ?? { name, count: 0 };
    existing.count += 1;
    sourceBrands.set(slug, existing);
  }
  for (const [slug, brand] of [...sourceBrands.values()].map((brand) => [slugify(brand.name), brand])) {
    if (context.brands.has(slug)) continue;
    const destinationId = `zvx-brand-${slug}`;
    const sourceDocumentId = `vendor:${slug}`;
    const existing = existingBrandsById.get(destinationId);
    if (existing && !sameDocumentId(existing, sourceDocumentId, sourceProjectId)) {
      plan.counts.conflicts += 1;
      plan.conflicts.push({ sourceId: sourceDocumentId, destinationId, types: ["brand-document-id"] });
      continue;
    }
    const data = {
      name: brand.name,
      slug,
      logo: "",
      logoUrl: "",
      description: `${brand.name} products imported from Zenvexa.`,
      productCount: brand.count,
      featured: false,
      active: true,
      seoTitle: brand.name,
      seoDescription: `${brand.name} products imported from Zenvexa.`,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      zenvexaSource: {
        projectId: sourceProjectId,
        vendor: brand.name,
      },
      zenvexaMigration: {
        sourceProjectId,
        sourceDocumentId,
        batchId,
      },
    };
    supportingWrites.push({ collection: "brands", id: destinationId, sourceId: sourceDocumentId, data });
    context.brands.set(slug, destinationId);
    plan.counts.brandsCreate += 1;
    plan.writes.push({ action: "create", collection: "brands", id: destinationId, sourceId: sourceDocumentId });
  }

  for (const item of supportingWrites) {
    if (writeBatch) writeBatch.set(db.doc(`${item.collection}/${item.id}`), item.data);
    writes += 1;
  }

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
      if (writeBatch) {
        writeBatch.set(db.doc(`products/${mapped.destinationId}`), {
          ...mapped.data,
          zenvexaMigration: {
            ...mapped.data.zenvexaMigration,
            checksum: checksum(incoming),
            importedAt: FieldValue.serverTimestamp(),
          },
        });
      }
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
    if (writeBatch) {
      writeBatch.set(db.doc(`products/${mapped.destinationId}`), {
        ...mapped.data,
        zenvexaMigration: {
          ...mapped.data.zenvexaMigration,
          checksum: checksum(incoming),
          importedAt: existing.zenvexaMigration.importedAt ?? FieldValue.serverTimestamp(),
        },
      });
    }
    writes += 1;
  }
  if (apply && writes) await writeBatch.commit();
}

if (apply) {
  const migratedProducts = await db
    .collection("products")
    .where("zenvexaMigration.sourceProjectId", "==", sourceProjectId)
    .where("zenvexaMigration.batchId", "==", batchId)
    .get();
  const migratedCategories = await db
    .collection("categories")
    .where("zenvexaMigration.sourceProjectId", "==", sourceProjectId)
    .where("zenvexaMigration.batchId", "==", batchId)
    .get();
  const migratedBrands = await db
    .collection("brands")
    .where("zenvexaMigration.sourceProjectId", "==", sourceProjectId)
    .where("zenvexaMigration.batchId", "==", batchId)
    .get();
  plan.verification = {
    migratedProducts: migratedProducts.size,
    migratedCategories: migratedCategories.size,
    migratedBrands: migratedBrands.size,
    sourceIds: migratedProducts.docs.map((document) => document.data().zenvexaMigration?.sourceDocumentId).sort(),
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
if (publicDryRun) process.exit(0);
