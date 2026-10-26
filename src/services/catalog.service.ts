import { cache } from "react";
import { getDoc, getDocs, query, where, limit as limitTo } from "firebase/firestore";
import {
  brandsCollection,
  brandDoc,
  categoriesCollection,
  categoryDoc,
} from "@/firebase/collections";
import type { Brand, Category } from "@/types/catalog";
import type { Product } from "@/types/product";
import { getActiveProducts } from "@/services/products.service";
import { slugify } from "@/utils/string";
import { cached, invalidateCache } from "@/lib/cache";

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/** Prefer the categories collection; fall back to deriving from products. */
const fetchCategoryDocs = cache(async (): Promise<Category[]> => {
  try {
    const snapshot = await getDocs(categoriesCollection());
    const docs = snapshot.docs
      .map((document) => document.data())
      .filter((category) => category.active !== false);
    if (docs.length) {
      return docs.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch {
    // Collection missing or rules not deployed yet.
  }
  return deriveCategoriesFromProducts(await getActiveProducts());
});

const fetchBrandDocs = cache(async (): Promise<Brand[]> => {
  try {
    const snapshot = await getDocs(brandsCollection());
    const docs = snapshot.docs
      .map((document) => document.data())
      .filter((brand) => brand.active !== false);
    if (docs.length) {
      return docs.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch {
    // Collection missing or rules not deployed yet.
  }
  return deriveBrandsFromProducts(await getActiveProducts());
});

function deriveCategoriesFromProducts(products: Product[]): Category[] {
  const map = new Map<string, Category>();
  for (const product of products) {
    const slug =
      product.categoryId ||
      (product.category ? slugify(product.category) : "uncategorised");
    const existing = map.get(slug);
    if (existing) {
      existing.productCount = (existing.productCount ?? 0) + 1;
      if (!existing.image && product.thumbnail) existing.image = product.thumbnail;
      continue;
    }
    map.set(slug, {
      id: slug,
      name: titleCase(product.category ?? "Uncategorised"),
      slug,
      description: `Shop ${titleCase(product.category ?? "products")} on ShopBeta.`,
      image: product.thumbnail,
      productCount: 1,
      featured: false,
      active: true,
      seoTitle: titleCase(product.category ?? "Uncategorised"),
      seoDescription: `Shop ${titleCase(product.category ?? "products")} on ShopBeta.`,
    });
  }
  const list = Array.from(map.values()).sort(
    (a, b) => (b.productCount ?? 0) - (a.productCount ?? 0),
  );
  list.slice(0, 6).forEach((category) => {
    category.featured = true;
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function deriveBrandsFromProducts(products: Product[]): Brand[] {
  const map = new Map<string, Brand>();
  for (const product of products) {
    const name = product.brand?.trim() || "Unbranded";
    const slug = product.brandId || slugify(name) || "unbranded";
    const existing = map.get(slug);
    if (existing) {
      existing.productCount = (existing.productCount ?? 0) + 1;
      continue;
    }
    map.set(slug, {
      id: slug,
      name,
      slug,
      description: `${name} products available on ShopBeta.`,
      logo: "",
      productCount: 1,
      featured: false,
      active: true,
      seoTitle: name,
      seoDescription: `${name} products available on ShopBeta.`,
    });
  }
  const list = Array.from(map.values()).sort(
    (a, b) => (b.productCount ?? 0) - (a.productCount ?? 0),
  );
  list.slice(0, 8).forEach((brand) => {
    brand.featured = true;
  });
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCategories(): Promise<Category[]> {
  return cached("catalog:categories", () => fetchCategoryDocs(), 60_000);
}

export async function getFeaturedCategories(max = 8): Promise<Category[]> {
  const categories = await getCategories();
  const featured = categories.filter((category) => category.featured);
  return (featured.length ? featured : categories).slice(0, max);
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | undefined> {
  try {
    const snapshot = await getDoc(categoryDoc(slug));
    if (snapshot.exists()) return snapshot.data();
  } catch {
    // Fall through to derived list.
  }
  const categories = await getCategories();
  return (
    categories.find((category) => category.slug === slug || category.id === slug) ??
    undefined
  );
}

export async function getBrands(): Promise<Brand[]> {
  return cached("catalog:brands", () => fetchBrandDocs(), 60_000);
}

/** Call after admin catalogue mutations when warm instances should refresh. */
export function invalidateCatalogCaches() {
  invalidateCache("catalog:");
}

export async function getFeaturedBrands(max = 12): Promise<Brand[]> {
  const brands = await getBrands();
  const featured = brands.filter((brand) => brand.featured);
  return (featured.length ? featured : brands).slice(0, max);
}

export async function getBrandBySlug(slug: string): Promise<Brand | undefined> {
  try {
    const snapshot = await getDoc(brandDoc(slug));
    if (snapshot.exists()) return snapshot.data();
  } catch {
    // Fall through.
  }
  const brands = await getBrands();
  return brands.find((brand) => brand.slug === slug || brand.id === slug);
}

/** Popular search suggestions derived from the live catalogue. */
export async function getPopularSearchTerms(max = 8): Promise<string[]> {
  const [categories, brands, products] = await Promise.all([
    getCategories(),
    getFeaturedBrands(4),
    getActiveProducts(12),
  ]);
  const terms = [
    ...categories.slice(0, 4).map((category) => category.name),
    ...brands.map((brand) => brand.name),
    ...products.slice(0, 4).map((product) => product.name.split(" ").slice(0, 2).join(" ")),
  ];
  return Array.from(
    new Set(terms.map((term) => term.trim()).filter(Boolean)),
  ).slice(0, max);
}

export async function searchCatalogHints(term: string, max = 6) {
  const needle = term.trim().toLowerCase();
  if (!needle) return [] as Product[];
  const products = await getActiveProducts();
  return products
    .filter((product) =>
      [product.name, product.brand ?? "", product.category ?? ""].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    )
    .slice(0, max);
}

/** Keep typed refs available for callers that need a direct doc read. */
export async function listActiveCategoryIds(max = 50) {
  try {
    const snapshot = await getDocs(
      query(categoriesCollection(), where("active", "==", true), limitTo(max)),
    );
    return snapshot.docs.map((document) => document.id);
  } catch {
    return (await getCategories()).map((category) => category.id);
  }
}
