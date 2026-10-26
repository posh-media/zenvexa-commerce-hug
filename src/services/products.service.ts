import { cache } from "react";
import {
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  where,
  type Query,
  type QueryConstraint,
} from "firebase/firestore";
import { productDoc, productsCollection } from "@/firebase/collections";
import type { Product } from "@/types/product";

/**
 * Legacy documents have no `active` field, so "active" is expressed as
 * `active != false` client-side rather than as a Firestore predicate.
 * Flag rails share one cached catalogue read per request to minimise reads.
 */
async function run(...constraints: QueryConstraint[]): Promise<Product[]> {
  const snapshot = await getDocs(
    query(productsCollection(), ...constraints) as Query<Product>,
  );
  return snapshot.docs.map((document) => document.data());
}

/** Deduplicated per render pass — one catalogue read for many sections. */
const fetchAll = cache(() => run());

async function fetchActive() {
  return (await fetchAll()).filter((product) => product.active !== false);
}

function exclude(
  products: Product[],
  usedIds: ReadonlySet<string>,
): Product[] {
  return products.filter((product) => !usedIds.has(product.id));
}

function take(
  products: Product[],
  max: number | undefined,
  usedIds?: Set<string>,
): Product[] {
  const pool = usedIds ? exclude(products, usedIds) : products;
  const slice = max == null ? pool : pool.slice(0, max);
  if (usedIds) {
    for (const product of slice) usedIds.add(product.id);
  }
  return slice;
}

export async function getActiveProducts(max?: number): Promise<Product[]> {
  const products = await fetchActive();
  return max ? products.slice(0, max) : products;
}

/** Alias kept for callers that just want the whole catalogue. */
export const listProducts = getActiveProducts;

async function byFlag(
  flag: "featured" | "trending" | "flashSale" | "bestSeller" | "sponsored",
  max?: number,
  usedIds?: Set<string>,
): Promise<Product[]> {
  const matches = (await fetchActive()).filter((product) => product[flag]);
  return take(matches, max, usedIds);
}

export const getFeaturedProducts = (max?: number) => byFlag("featured", max);
export const getTrendingProducts = (max?: number) => byFlag("trending", max);
export const getFlashSaleProducts = (max?: number) => byFlag("flashSale", max);
export const getBestSellers = (max?: number) => byFlag("bestSeller", max);
export const getSponsoredProducts = (max?: number) => byFlag("sponsored", max);

/** Products with a discount, biggest saving first. */
export async function getDiscountedProducts(max?: number): Promise<Product[]> {
  const products = (await fetchActive())
    .filter((product) => product.discount > 0)
    .sort((a, b) => b.discount - a.discount);
  return max ? products.slice(0, max) : products;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const snapshot = await getDoc(productDoc(id));
  return snapshot.exists() ? snapshot.data() : undefined;
}

/**
 * Resolves stored `slug`, then document id, then converter-derived slug so
 * legacy documents remain reachable before migration.
 */
export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  try {
    const [indexed] = await run(where("slug", "==", slug), limitTo(1));
    if (indexed) return indexed;
  } catch {
    // Index or permission issues — fall through.
  }
  const byId = await getProductById(slug);
  if (byId) return byId;
  return (await fetchAll()).find((product) => product.slug === slug);
}

export async function getProductsByCategory(
  category: string,
  max?: number,
): Promise<Product[]> {
  const needle = category.trim().toLowerCase();
  try {
    const indexed = await run(
      where("categoryId", "==", needle),
      where("active", "==", true),
      limitTo(max ?? 100),
    );
    if (indexed.length) return indexed;
  } catch {
    // Composite index may be undeployed — fall back to cached catalogue.
  }
  const products = (await fetchActive()).filter((product) => {
    const categoryId = product.categoryId?.toLowerCase();
    const categoryName = product.category?.toLowerCase();
    return (
      categoryId === needle ||
      categoryName === needle ||
      categoryName?.replace(/\s+/g, "-") === needle
    );
  });
  return max ? products.slice(0, max) : products;
}

export async function getProductsByBrand(
  brand: string,
  max?: number,
): Promise<Product[]> {
  const needle = brand.trim().toLowerCase();
  try {
    const indexed = await run(
      where("brandId", "==", needle),
      where("active", "==", true),
      limitTo(max ?? 100),
    );
    if (indexed.length) return indexed;
  } catch {
    // Fall back.
  }
  const products = (await fetchActive()).filter((product) => {
    const brandId = product.brandId?.toLowerCase();
    const brandName = product.brand?.toLowerCase();
    return brandId === needle || brandName === needle;
  });
  return max ? products.slice(0, max) : products;
}

/** Same category first, then brand, then tags — excluding used ids. */
export async function getRelatedProducts(
  product: Product,
  max = 4,
  excludeIds: ReadonlySet<string> = new Set(),
): Promise<Product[]> {
  const used = new Set(excludeIds);
  used.add(product.id);
  const products = exclude(await fetchActive(), used);

  const sameCategory = products.filter(
    (item) =>
      item.categoryId === product.categoryId ||
      item.category === product.category,
  );
  const sameBrand = products.filter(
    (item) =>
      !sameCategory.includes(item) &&
      ((product.brandId && item.brandId === product.brandId) ||
        (product.brand && item.brand === product.brand)),
  );
  const tagged = products.filter(
    (item) =>
      !sameCategory.includes(item) &&
      !sameBrand.includes(item) &&
      item.tags.some((tag) => product.tags.includes(tag)),
  );
  const rest = products.filter(
    (item) =>
      !sameCategory.includes(item) &&
      !sameBrand.includes(item) &&
      !tagged.includes(item),
  );
  return [...sameCategory, ...sameBrand, ...tagged, ...rest].slice(0, max);
}

/** Brand-first recommendations; never overlaps the related set when excluded. */
export async function getYouMayAlsoLike(
  product: Product,
  max = 4,
  excludeIds: ReadonlySet<string> = new Set(),
): Promise<Product[]> {
  const used = new Set(excludeIds);
  used.add(product.id);
  const products = exclude(await fetchActive(), used);
  const sameBrand = products.filter(
    (item) =>
      (product.brandId && item.brandId === product.brandId) ||
      (product.brand && item.brand === product.brand),
  );
  if (sameBrand.length >= max) return sameBrand.slice(0, max);
  const related = await getRelatedProducts(product, max * 2, used);
  const merged = [...sameBrand];
  for (const item of related) {
    if (!merged.some((entry) => entry.id === item.id)) merged.push(item);
    if (merged.length >= max) break;
  }
  return merged.slice(0, max);
}

/**
 * Recently added — newest `createdAt` first. Falls back to the cached
 * catalogue when the composite index is unavailable.
 */
export async function getLatestProducts(max = 4): Promise<Product[]> {
  try {
    const products = (
      await run(
        where("active", "==", true),
        orderBy("createdAt", "desc"),
        limitTo(max),
      )
    ).filter((product) => product.active !== false);
    if (products.length) return products;
  } catch {
    // Index may be undeployed.
  }
  try {
    const products = (await run(orderBy("createdAt", "desc"), limitTo(max))).filter(
      (product) => product.active !== false,
    );
    if (products.length) return products;
  } catch {
    // Fall through.
  }
  const sorted = [...(await fetchActive())].sort(
    (a, b) =>
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0) ||
      b.id.localeCompare(a.id),
  );
  return sorted.slice(0, max);
}

/** Alias for home / deals “Recently added” rails. */
export const getRecentlyAddedProducts = getLatestProducts;

export async function searchProducts(
  term: string,
  max?: number,
): Promise<Product[]> {
  const needle = term.trim().toLowerCase();
  if (!needle) return getActiveProducts(max);
  const products = (await fetchActive()).filter((product) => {
    const tags = product.tags?.join(" ") ?? "";
    const keywords = product.searchKeywords?.join(" ") ?? "";
    return [
      product.name,
      product.productName,
      product.description,
      product.category ?? "",
      product.brand ?? "",
      product.brandId ?? "",
      product.sku ?? "",
      tags,
      keywords,
    ].some((field) => field.toLowerCase().includes(needle));
  });
  return max ? products.slice(0, max) : products;
}

/**
 * Home catalogue sections from a single cached read. Each rail excludes
 * products already shown so recommendations do not repeat on the same page.
 */
export async function getHomeCatalogSections(railSize = 4) {
  const catalog = await fetchActive();
  const used = new Set<string>();

  const flash = take(
    catalog.filter((product) => product.flashSale),
    railSize,
    used,
  );
  const featured = take(
    catalog.filter((product) => product.featured),
    railSize,
    used,
  );
  const trending = take(
    catalog.filter((product) => product.trending),
    railSize,
    used,
  );
  const recent = take(
    [...catalog].sort(
      (a, b) =>
        (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0) ||
        b.id.localeCompare(a.id),
    ),
    railSize,
    used,
  );
  const best = take(
    catalog.filter((product) => product.bestSeller),
    railSize,
    used,
  );
  const offers = take(
    [...catalog]
      .filter((product) => product.discount > 0)
      .sort((a, b) => b.discount - a.discount),
    3,
    used,
  );

  return {
    catalog,
    flash,
    featured,
    trending,
    recent,
    best,
    offers,
    heroSource: featured[0] ?? catalog[0],
  };
}

/** Top products for 404 / empty-state suggestions. */
export async function getPopularProducts(max = 4): Promise<Product[]> {
  const bestsellers = await getBestSellers(max);
  if (bestsellers.length >= max) return bestsellers;
  const trending = await getTrendingProducts(max);
  const merged = [...bestsellers];
  for (const product of trending) {
    if (!merged.some((item) => item.id === product.id)) merged.push(product);
    if (merged.length >= max) break;
  }
  if (merged.length) return merged.slice(0, max);
  return getActiveProducts(max);
}
