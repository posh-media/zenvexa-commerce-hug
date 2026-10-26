#!/usr/bin/env node
/**
 * Rebuild the development catalog from DummyJSON + derive categories/brands.
 *
 * Dry-run by default. Pass --apply to write. Never deletes documents.
 * Product imports only touch `dummyjson-*` ids; legacy docs (note100, pro001,
 * and any other non-dummyjson ids) are left alone.
 *
 * Usage:
 *   node scripts/seed-catalog.mjs
 *   node scripts/seed-catalog.mjs --apply
 *   node scripts/seed-catalog.mjs --credentials=key.json --apply
 *   node scripts/seed-catalog.mjs --apply --products-only
 *   node scripts/seed-catalog.mjs --apply --meta-only
 *
 * Credentials: --credentials, GOOGLE_APPLICATION_CREDENTIALS, or
 * FIREBASE_SERVICE_ACCOUNT (raw JSON).
 */
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore, parseArgs } from "./lib/admin.mjs";

const { flag, option } = parseArgs();

const APPLY = flag("apply");
const PRODUCTS_ONLY = flag("products-only");
const META_ONLY = flag("meta-only");
const PRODUCTS = "products";
const CATEGORIES = "categories";
const BRANDS = "brands";
const DUMMYJSON_PREFIX = "dummyjson-";
const USD_TO_NGN = 1600;
const FEATURED_CATEGORY_LIMIT = 8;
const FEATURED_BRAND_LIMIT = 12;
const UNBRANDED_ID = "unbranded";
const UNBRANDED_NAME = "Unbranded";
const DUMMYJSON_URL = "https://dummyjson.com/products?limit=0";

if (PRODUCTS_ONLY && META_ONLY) {
  console.error("Use only one of --products-only or --meta-only.");
  process.exit(1);
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function titleCase(value) {
  return String(value ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function toTimestamp(value, fallback = Timestamp.now()) {
  if (!value) return fallback;
  if (value instanceof Timestamp) return value;
  if (typeof value?.toDate === "function") return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : Timestamp.fromDate(date);
}

function ngnPrice(usd) {
  return Math.round(Number(usd) || 0) * USD_TO_NGN;
}

function assignFlags(id, hasBrand) {
  return {
    featured: id % 7 === 3,
    trending: id % 5 === 2,
    flashSale: id % 12 === 1,
    bestSeller: id % 11 === 4,
    sponsored: id % 14 === 0,
    officialStore: hasBrand && id % 5 !== 0,
  };
}

function buildTags({ featured, trending, flashSale, bestSeller, discount }) {
  const tags = [];
  if (flashSale) tags.push("flash-sale");
  if (featured) tags.push("featured");
  if (trending) tags.push("trending");
  if (bestSeller) tags.push("best-seller");
  if (discount > 0) tags.push("special-offer");
  return tags;
}

function buildKeywords(product, categoryTitle, brandName) {
  const words = new Set();
  const addTokens = (value, { compact = false } = {}) => {
    const lower = String(value ?? "").toLowerCase();
    for (const token of lower.split(/[^a-z0-9]+/)) {
      if (token.length > 2) words.add(token);
    }
    if (compact) {
      const joined = lower.replace(/[^a-z0-9]+/g, "");
      if (joined.length > 2) words.add(joined);
    }
  };

  addTokens(categoryTitle);
  addTokens(brandName);
  addTokens(product.title);
  for (const tag of product.tags ?? []) {
    addTokens(tag, { compact: true });
  }
  return [...words];
}

function buildSpecifications(product, categoryTitle, sku) {
  const specs = [];
  if (product.brand) specs.push({ label: "Brand", value: String(product.brand) });
  specs.push({ label: "Category", value: categoryTitle });
  specs.push({ label: "SKU", value: sku });
  if (product.availabilityStatus) {
    specs.push({ label: "Availability", value: String(product.availabilityStatus) });
  }
  if (product.weight != null) {
    specs.push({ label: "Weight", value: `${product.weight} kg` });
  }
  if (product.dimensions) {
    const { width, height, depth } = product.dimensions;
    specs.push({
      label: "Dimensions",
      value: `${width} × ${height} × ${depth} cm`,
    });
  }
  if (product.warrantyInformation) {
    specs.push({ label: "Warranty", value: String(product.warrantyInformation) });
  }
  if (product.shippingInformation) {
    specs.push({ label: "Shipping", value: String(product.shippingInformation) });
  }
  if (product.returnPolicy) {
    specs.push({ label: "Returns", value: String(product.returnPolicy) });
  }
  if (product.minimumOrderQuantity != null) {
    specs.push({
      label: "Minimum order",
      value: `${product.minimumOrderQuantity} unit(s)`,
    });
  }
  return specs;
}

function mapReviews(reviews) {
  if (!Array.isArray(reviews)) return [];
  return reviews.map((review) => ({
    reviewBy: String(review.reviewerName ?? "Anonymous"),
    rating: Number(review.rating) || 0,
    comment: String(review.comment ?? ""),
    date: String(review.date ?? ""),
  }));
}

function coreFingerprint(doc) {
  return JSON.stringify({
    productName: doc.productName ?? null,
    description: doc.description ?? null,
    price: doc.price ?? null,
    discount: doc.discount ?? null,
    stock: doc.stock ?? null,
    slug: doc.slug ?? null,
    sku: doc.sku ?? null,
    barcode: doc.barcode ?? null,
    categoryId: doc.categoryId ?? null,
    brandId: doc.brandId ?? null,
    brand: doc.brand ?? null,
    thumbnail: doc.thumbnail ?? null,
    rating: doc.rating ?? null,
  });
}

function buildProductDocument(product, existing) {
  const id = product.id;
  const docId = `${DUMMYJSON_PREFIX}${id}`;
  const categoryId = slugify(product.category);
  const categoryTitle = titleCase(product.category);
  const brandName = product.brand ? String(product.brand) : null;
  const brandId = brandName ? slugify(brandName) : null;
  const sku = String(product.sku ?? `${categoryId.slice(0, 3)}-xxx-${String(id).padStart(3, "0")}`).toUpperCase();
  const barcode = String(product.meta?.barcode ?? `SB-${docId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()}`);
  const discount = Math.round(Number(product.discountPercentage) || 0);
  const flags = assignFlags(id, Boolean(brandName));
  const tags = buildTags({ ...flags, discount });
  const specifications = buildSpecifications(product, categoryTitle, sku);
  const reviews = mapReviews(product.reviews);
  const images = Array.isArray(product.images) ? product.images : [];
  const now = Timestamp.now();
  const createdAt = existing?.createdAt
    ? toTimestamp(existing.createdAt)
    : toTimestamp(product.meta?.createdAt, now);

  const productName = String(product.title ?? docId);
  const description = String(product.description ?? "");
  const stock = Number(product.stock) || 0;
  const keywords = buildKeywords(product, categoryTitle, brandName);
  const stockStatus =
    stock <= 0 ? "out_of_stock" : stock <= 5 ? "low_stock" : "in_stock";

  const doc = {
    productName,
    description,
    price: ngnPrice(product.price),
    discount,
    currency: "NGN",
    rating: Number(product.rating) || 0,
    category: categoryTitle,
    categoryId,
    specification: specifications.map((entry) => `${entry.label}: ${entry.value}`).join("\n"),
    specifications,
    sponsored: flags.sponsored,
    officialStore: flags.officialStore,
    reviews,
    variation: Array.isArray(product.tags) ? product.tags.map(String) : [],
    slug: slugify(product.title) || docId,
    sku,
    barcode,
    images,
    thumbnail: String(product.thumbnail ?? images[0] ?? ""),
    stock,
    stockStatus,
    reviewCount: reviews.length,
    variants: [],
    tags,
    featured: flags.featured,
    trending: flags.trending,
    flashSale: flags.flashSale,
    bestSeller: flags.bestSeller,
    active: true,
    seoTitle: productName,
    seoDescription: description ? description.slice(0, 160) : `${productName} on ShopBeta`,
    seoKeywords: keywords,
    searchKeywords: keywords,
    keywords,
    viewCount: existing?.viewCount ?? 0,
    salesCount: existing?.salesCount ?? 0,
    wishlistCount: existing?.wishlistCount ?? 0,
    createdAt,
    updatedAt: now,
  };

  if (brandName && brandId) {
    doc.brand = brandName;
    doc.brandId = brandId;
  }

  return { docId, doc };
}

async function fetchDummyProducts() {
  const response = await fetch(DUMMYJSON_URL);
  if (!response.ok) {
    throw new Error(`DummyJSON fetch failed: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json();
  const products = Array.isArray(payload.products) ? payload.products : [];
  if (!products.length) {
    throw new Error("DummyJSON returned no products.");
  }
  console.log(`Fetched ${products.length} product(s) from DummyJSON (total=${payload.total ?? products.length}).`);
  return products;
}

async function seedProducts(db) {
  const products = await fetchDummyProducts();
  const summary = { created: 0, updated: 0, skipped: 0, total: products.length };

  for (const product of products) {
    const { docId, doc } = buildProductDocument(product, null);
    const ref = db.collection(PRODUCTS).doc(docId);
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() : null;

    if (existing) {
      const next = buildProductDocument(product, existing).doc;
      // Preserve an existing brandId/brand when DummyJSON has no brand (meta step owns unbranded).
      if (!next.brandId && existing.brandId) {
        next.brandId = existing.brandId;
        if (existing.brand) next.brand = existing.brand;
      }
      // Never reset engagement counters on re-seed.
      if (typeof existing.viewCount === "number") next.viewCount = existing.viewCount;
      if (typeof existing.salesCount === "number") next.salesCount = existing.salesCount;
      if (typeof existing.wishlistCount === "number") {
        next.wishlistCount = existing.wishlistCount;
      }
      if (coreFingerprint(existing) === coreFingerprint(next)) {
        summary.skipped += 1;
        console.log(`· ${docId}: unchanged`);
        continue;
      }
      summary.updated += 1;
      console.log(`~ ${docId}: update`);
      if (APPLY) await ref.set(next, { merge: true });
    } else {
      summary.created += 1;
      console.log(`+ ${docId}: create`);
      if (APPLY) await ref.set(doc, { merge: true });
    }
  }

  return summary;
}

function resolveCategory(data) {
  if (typeof data.categoryId === "string" && data.categoryId.trim()) {
    return {
      id: slugify(data.categoryId),
      name:
        typeof data.category === "string" && data.category.trim()
          ? data.category
          : titleCase(data.categoryId),
    };
  }
  if (typeof data.category === "string" && data.category.trim()) {
    return { id: slugify(data.category), name: titleCase(data.category) };
  }
  return null;
}

function resolveBrand(data) {
  if (typeof data.brandId === "string" && data.brandId.trim()) {
    return {
      id: slugify(data.brandId),
      name:
        typeof data.brand === "string" && data.brand.trim()
          ? data.brand
          : titleCase(data.brandId),
    };
  }
  if (typeof data.brand === "string" && data.brand.trim()) {
    return { id: slugify(data.brand), name: data.brand };
  }
  return null;
}

async function seedMeta(db) {
  const snapshot = await db.collection(PRODUCTS).get();
  const now = Timestamp.now();
  const summary = {
    productsScanned: snapshot.size,
    brandBackfills: 0,
    categoriesUpserted: 0,
    brandsUpserted: 0,
  };

  const categoryStats = new Map();
  const brandStats = new Map();

  // Additive brandId backfill for dummyjson docs only — never touch legacy ids.
  for (const document of snapshot.docs) {
    const data = document.data();
    const isDummy = document.id.startsWith(DUMMYJSON_PREFIX);
    const missingBrand =
      isDummy &&
      (data.brandId === undefined || data.brandId === null || data.brandId === "");

    if (missingBrand) {
      summary.brandBackfills += 1;
      console.log(`+ ${document.id}: brandId → ${UNBRANDED_ID}`);
      if (APPLY) {
        await document.ref.set(
          {
            brandId: UNBRANDED_ID,
            brand: UNBRANDED_NAME,
            updatedAt: now,
          },
          { merge: true },
        );
      }
      data.brandId = UNBRANDED_ID;
      data.brand = UNBRANDED_NAME;
    }

    const category = resolveCategory(data);
    if (category) {
      const entry = categoryStats.get(category.id) ?? {
        name: category.name,
        slug: category.id,
        productCount: 0,
        image: "",
      };
      entry.productCount += 1;
      if (!entry.image) {
        const thumb =
          (typeof data.thumbnail === "string" && data.thumbnail) ||
          (Array.isArray(data.images) && data.images[0]) ||
          (Array.isArray(data.imgs) && data.imgs[0]) ||
          "";
        if (typeof thumb === "string" && thumb && !thumb.startsWith("data:")) {
          entry.image = thumb;
        }
      }
      categoryStats.set(category.id, entry);
    }

    const brand = resolveBrand(data);
    if (brand) {
      const entry = brandStats.get(brand.id) ?? {
        name: brand.name,
        slug: brand.id,
        productCount: 0,
      };
      entry.productCount += 1;
      if (!entry.name && brand.name) entry.name = brand.name;
      brandStats.set(brand.id, entry);
    }
  }

  // Ensure the unbranded brand exists even if no backfills were needed this run.
  if (!brandStats.has(UNBRANDED_ID)) {
    brandStats.set(UNBRANDED_ID, {
      name: UNBRANDED_NAME,
      slug: UNBRANDED_ID,
      productCount: 0,
    });
  }

  const featuredCategoryIds = new Set(
    [...categoryStats.entries()]
      .sort((a, b) => b[1].productCount - a[1].productCount)
      .slice(0, FEATURED_CATEGORY_LIMIT)
      .map(([id]) => id),
  );
  const featuredBrandIds = new Set(
    [...brandStats.entries()]
      .filter(([id]) => id !== UNBRANDED_ID)
      .sort((a, b) => b[1].productCount - a[1].productCount)
      .slice(0, FEATURED_BRAND_LIMIT)
      .map(([id]) => id),
  );

  for (const [id, stats] of categoryStats) {
    const description = `Browse ${stats.name} products on ShopBeta.`;
    const payload = {
      name: stats.name,
      slug: stats.slug,
      productCount: stats.productCount,
      featured: featuredCategoryIds.has(id),
      active: true,
      updatedAt: now,
    };
    summary.categoriesUpserted += 1;
    console.log(
      `~ ${CATEGORIES}/${id}: ${stats.productCount} product(s)${payload.featured ? " [featured]" : ""}`,
    );
    if (APPLY) {
      const ref = db.collection(CATEGORIES).doc(id);
      const existing = await ref.get();
      const current = existing.exists ? existing.data() : {};
      const patch = {
        ...payload,
        description: current.description || description,
        image: current.image || stats.image || "",
        seoTitle: current.seoTitle || stats.name,
        seoDescription: current.seoDescription || description,
        createdAt: current.createdAt || now,
      };
      await ref.set(patch, { merge: true });
    }
  }

  for (const [id, stats] of brandStats) {
    const description = `${stats.name} products on ShopBeta.`;
    const payload = {
      name: stats.name,
      slug: stats.slug,
      productCount: stats.productCount,
      featured: featuredBrandIds.has(id),
      active: true,
      updatedAt: now,
    };
    summary.brandsUpserted += 1;
    console.log(
      `~ ${BRANDS}/${id}: ${stats.productCount} product(s)${payload.featured ? " [featured]" : ""}`,
    );
    if (APPLY) {
      const ref = db.collection(BRANDS).doc(id);
      const existing = await ref.get();
      const current = existing.exists ? existing.data() : {};
      const patch = {
        ...payload,
        description: current.description || description,
        logo: current.logo ?? current.logoUrl ?? "",
        seoTitle: current.seoTitle || stats.name,
        seoDescription: current.seoDescription || description,
        createdAt: current.createdAt || now,
      };
      await ref.set(patch, { merge: true });
    }
  }

  return summary;
}

async function main() {
  const db = getAdminFirestore(option("credentials"));
  console.log(
    `${APPLY ? "APPLY" : "DRY RUN"} — seed-catalog` +
      (PRODUCTS_ONLY ? " (products-only)" : META_ONLY ? " (meta-only)" : "") +
      "\n",
  );

  const report = {};

  if (!META_ONLY) {
    console.log("== Products ==");
    report.products = await seedProducts(db);
  }

  if (!PRODUCTS_ONLY) {
    console.log("\n== Categories & brands ==");
    report.meta = await seedMeta(db);
  }

  console.log("\n== Summary ==");
  if (report.products) {
    const { created, updated, skipped, total } = report.products;
    console.log(
      `Products: ${total} source → ${created} create, ${updated} update, ${skipped} skip` +
        (APPLY ? "" : " (dry-run)"),
    );
  }
  if (report.meta) {
    const { productsScanned, brandBackfills, categoriesUpserted, brandsUpserted } =
      report.meta;
    console.log(
      `Meta: scanned ${productsScanned} product(s); brand backfills ${brandBackfills}; ` +
        `categories ${categoriesUpserted}; brands ${brandsUpserted}` +
        (APPLY ? "" : " (dry-run)"),
    );
  }
  if (!APPLY) console.log("Re-run with --apply to write these changes.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
