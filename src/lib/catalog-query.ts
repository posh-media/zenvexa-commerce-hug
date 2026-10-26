import type { Product as ProductView } from "@/lib/data";
import { PAGINATION } from "@/constants/app";

export type CatalogSort =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating"
  | "reviews"
  | "discount"
  | "featured"
  | "alphabetical"
  | "relevant";

export type CatalogFilters = {
  categories: string[];
  brands: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly: boolean;
  sponsored: boolean;
  officialStore: boolean;
  featured: boolean;
  trending: boolean;
  flashSale: boolean;
  bestSeller: boolean;
};

export const DEFAULT_FILTERS: CatalogFilters = {
  categories: [],
  brands: [],
  minPrice: undefined,
  maxPrice: undefined,
  minRating: undefined,
  inStockOnly: false,
  sponsored: false,
  officialStore: false,
  featured: false,
  trending: false,
  flashSale: false,
  bestSeller: false,
};

export const SORT_OPTIONS: Array<{ id: CatalogSort; label: string }> = [
  { id: "relevant", label: "Most relevant" },
  { id: "newest", label: "Newest arrivals" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "rating", label: "Top rated / highest rated" },
  { id: "reviews", label: "Most reviewed" },
  { id: "discount", label: "Biggest discount" },
  { id: "featured", label: "Featured" },
  { id: "alphabetical", label: "Alphabetical" },
];

export function emptyFilters(): CatalogFilters {
  return {
    ...DEFAULT_FILTERS,
    categories: [],
    brands: [],
  };
}

function matchesTag(
  product: ProductView,
  tag: ProductView["tags"][number],
): boolean {
  return product.tags.includes(tag);
}

export function filterProductViews(
  items: ProductView[],
  filters: CatalogFilters,
): ProductView[] {
  return items.filter((product) => {
    if (
      filters.categories.length &&
      !filters.categories.some(
        (value) =>
          product.category.toLowerCase() === value.toLowerCase() ||
          product.categoryId === value ||
          slugifyLabel(product.category) === value,
      )
    ) {
      return false;
    }
    if (
      filters.brands.length &&
      !filters.brands.some(
        (value) =>
          product.brand.toLowerCase() === value.toLowerCase() ||
          product.brandId === value ||
          slugifyLabel(product.brand) === value,
      )
    ) {
      return false;
    }
    if (filters.minPrice != null && product.price < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice != null && product.price > filters.maxPrice) {
      return false;
    }
    if (filters.minRating != null && product.rating < filters.minRating) {
      return false;
    }
    if (filters.inStockOnly && product.stock <= 0) return false;
    if (filters.sponsored && !product.sponsored) return false;
    if (filters.officialStore && !product.officialStore) return false;
    if (filters.featured && !matchesTag(product, "featured")) return false;
    if (filters.trending && !matchesTag(product, "trending")) return false;
    if (filters.flashSale && !matchesTag(product, "flash-sale")) return false;
    if (filters.bestSeller && !matchesTag(product, "best-seller")) return false;
    return true;
  });
}

export function sortProductViews(
  items: ProductView[],
  sort: CatalogSort,
): ProductView[] {
  const next = [...items];
  switch (sort) {
    case "newest":
      return next.sort(
        (a, b) =>
          (b.createdAt ?? 0) - (a.createdAt ?? 0) || b.id.localeCompare(a.id),
      );
    case "price-asc":
      return next.sort((a, b) => a.price - b.price);
    case "price-desc":
      return next.sort((a, b) => b.price - a.price);
    case "rating":
      return next.sort((a, b) => b.rating - a.rating);
    case "reviews":
      return next.sort((a, b) => b.reviews - a.reviews);
    case "discount":
      return next.sort((a, b) => {
        const da = a.oldPrice ? a.oldPrice - a.price : 0;
        const db = b.oldPrice ? b.oldPrice - b.price : 0;
        return db - da;
      });
    case "featured":
      return next.sort((a, b) => {
        const fa = a.tags.includes("featured") ? 1 : 0;
        const fb = b.tags.includes("featured") ? 1 : 0;
        return fb - fa || b.rating - a.rating;
      });
    case "alphabetical":
      return next.sort((a, b) => a.name.localeCompare(b.name));
    case "relevant":
    default:
      return next;
  }
}

export function paginateProductViews(
  items: ProductView[],
  page: number,
  pageSize = PAGINATION.productsPerPage,
) {
  const safePage = Math.max(1, page);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const current = Math.min(safePage, totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    totalPages,
    total: items.length,
    pageSize,
  };
}

export function applyCatalogQuery(
  items: ProductView[],
  filters: CatalogFilters,
  sort: CatalogSort,
  page = 1,
) {
  const filtered = filterProductViews(items, filters);
  const sorted = sortProductViews(filtered, sort);
  return paginateProductViews(sorted, page);
}

export function priceBoundsFromViews(items: ProductView[]) {
  if (!items.length) return { min: 0, max: 0 };
  let min = items[0].price;
  let max = items[0].price;
  for (const item of items) {
    min = Math.min(min, item.price);
    max = Math.max(max, item.price);
  }
  return { min, max };
}

export function slugifyLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseSortParam(value?: string | null): CatalogSort {
  const match = SORT_OPTIONS.find((option) => option.id === value);
  return match?.id ?? "relevant";
}

export function filtersFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): CatalogFilters {
  const get = (key: string) => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const getAll = (key: string) => {
    if (params instanceof URLSearchParams) {
      const multi = params.getAll(key);
      if (multi.length) return multi;
      const csv = params.get(key);
      return csv ? csv.split(",").filter(Boolean) : [];
    }
    const value = params[key];
    if (Array.isArray(value)) return value.filter(Boolean);
    return value ? String(value).split(",").filter(Boolean) : [];
  };
  const flag = (key: string) => get(key) === "1" || get(key) === "true";

  const minRating = get("rating");
  const minPrice = get("minPrice");
  const maxPrice = get("maxPrice");

  return {
    categories: getAll("category"),
    brands: getAll("brand"),
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    inStockOnly: flag("inStock"),
    sponsored: flag("sponsored"),
    officialStore: flag("officialStore"),
    featured: flag("featured"),
    trending: flag("trending"),
    flashSale: flag("flashSale"),
    bestSeller: flag("bestSeller"),
  };
}

export function searchParamsFromFilters(
  filters: CatalogFilters,
  sort: CatalogSort,
  page: number,
  query?: string,
) {
  const params = new URLSearchParams();
  if (query?.trim()) params.set("q", query.trim());
  for (const category of filters.categories) params.append("category", category);
  for (const brand of filters.brands) params.append("brand", brand);
  if (filters.minPrice != null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice != null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.minRating != null) params.set("rating", String(filters.minRating));
  if (filters.inStockOnly) params.set("inStock", "1");
  if (filters.sponsored) params.set("sponsored", "1");
  if (filters.officialStore) params.set("officialStore", "1");
  if (filters.featured) params.set("featured", "1");
  if (filters.trending) params.set("trending", "1");
  if (filters.flashSale) params.set("flashSale", "1");
  if (filters.bestSeller) params.set("bestSeller", "1");
  if (sort !== "relevant") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  return params;
}

/** Count active filter chips for UI badges. */
export function countActiveFilters(filters: CatalogFilters) {
  return (
    filters.categories.length +
    filters.brands.length +
    (filters.minPrice != null ? 1 : 0) +
    (filters.maxPrice != null ? 1 : 0) +
    (filters.minRating != null ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.sponsored ? 1 : 0) +
    (filters.officialStore ? 1 : 0) +
    (filters.featured ? 1 : 0) +
    (filters.trending ? 1 : 0) +
    (filters.flashSale ? 1 : 0) +
    (filters.bestSeller ? 1 : 0)
  );
}
