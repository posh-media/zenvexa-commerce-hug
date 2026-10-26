import type { Product as ProductView } from "@/lib/data";
import type { Brand, Category } from "@/lib/data";
import { toProductViews } from "@/lib/product-view";
import { searchProducts } from "@/services/products.service";

export type SearchSuggestionKind =
  | "product"
  | "category"
  | "brand"
  | "recent"
  | "popular";

export type SearchSuggestion = {
  id: string;
  label: string;
  kind: SearchSuggestionKind;
  href: string;
  secondary?: string;
};

/** Shared text-match helper used by search services and suggestion builders. */
export function matchesSearchNeedle(
  haystack: Array<string | undefined | null>,
  needle: string,
) {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return haystack.some((field) =>
    String(field ?? "")
      .toLowerCase()
      .includes(q),
  );
}

export async function globalProductSearch(
  term: string,
  max?: number,
): Promise<ProductView[]> {
  return toProductViews(await searchProducts(term, max));
}

export function buildSearchSuggestions({
  query,
  recent = [],
  popular = [],
  categories = [],
  brands = [],
  products = [],
  limit = 8,
}: {
  query: string;
  recent?: string[];
  popular?: string[];
  categories?: Category[];
  brands?: Brand[];
  products?: ProductView[];
  limit?: number;
}): SearchSuggestion[] {
  const q = query.trim().toLowerCase();
  const suggestions: SearchSuggestion[] = [];

  if (!q) {
    for (const term of recent.slice(0, 4)) {
      suggestions.push({
        id: `recent-${term}`,
        label: term,
        kind: "recent",
        href: `/search?q=${encodeURIComponent(term)}`,
      });
    }
    for (const term of popular.slice(0, 5)) {
      if (suggestions.some((item) => item.label.toLowerCase() === term.toLowerCase())) {
        continue;
      }
      suggestions.push({
        id: `popular-${term}`,
        label: term,
        kind: "popular",
        href: `/search?q=${encodeURIComponent(term)}`,
      });
    }
    return suggestions.slice(0, limit);
  }

  for (const category of categories) {
    if (!matchesSearchNeedle([category.name], q)) continue;
    suggestions.push({
      id: `cat-${category.slug}`,
      label: category.name,
      kind: "category",
      href: `/category/${category.slug}`,
      secondary: "Category",
    });
  }

  for (const brand of brands) {
    if (!matchesSearchNeedle([brand.name], q)) continue;
    suggestions.push({
      id: `brand-${brand.slug}`,
      label: brand.name,
      kind: "brand",
      href: `/brands?q=${encodeURIComponent(brand.name)}`,
      secondary: "Brand",
    });
  }

  for (const product of products.slice(0, 6)) {
    suggestions.push({
      id: `product-${product.id}`,
      label: product.name,
      kind: "product",
      href: `/product/${product.slug}`,
      secondary: product.brand,
    });
  }

  for (const term of popular) {
    if (!term.toLowerCase().includes(q)) continue;
    if (suggestions.some((item) => item.label.toLowerCase() === term.toLowerCase())) {
      continue;
    }
    suggestions.push({
      id: `popular-${term}`,
      label: term,
      kind: "popular",
      href: `/search?q=${encodeURIComponent(term)}`,
    });
  }

  return suggestions.slice(0, limit);
}
