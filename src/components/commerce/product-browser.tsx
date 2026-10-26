"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import type { Brand, Category, Product } from "@/lib/data";
import {
  applyCatalogQuery,
  emptyFilters,
  filtersFromSearchParams,
  parseSortParam,
  priceBoundsFromViews,
  searchParamsFromFilters,
  SORT_OPTIONS,
  type CatalogFilters,
  type CatalogSort,
} from "@/lib/catalog-query";
import { cn } from "@/lib/utils";
import { useCatalogAnalytics } from "@/hooks/use-catalog-analytics";
import { Dropdown } from "@/components/ui/dropdown";
import { Pagination } from "@/components/ui/pagination";
import { ProductCard, ProductListCard } from "@/components/commerce/product-card";
import {
  ActiveFilters,
  FilterDrawer,
  FilterPanel,
} from "@/components/commerce/filters";
import { CatalogEmpty } from "@/components/commerce/catalog-state";

export function ProductBrowser({
  items,
  categories = [],
  brands = [],
  showFilterDrawer = true,
  showActiveFilters = true,
  showPagination = true,
  showSidebarFilters = false,
  preserveQuery = false,
}: {
  items: Product[];
  categories?: Category[];
  brands?: Brand[];
  showFilterDrawer?: boolean;
  showActiveFilters?: boolean;
  showPagination?: boolean;
  /** When true, renders the desktop filter panel inside the browser. */
  showSidebarFilters?: boolean;
  /** Keep `q` when syncing URL params (search page). */
  preserveQuery?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { track } = useCatalogAnalytics();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<CatalogFilters>(() =>
    filtersFromSearchParams(searchParams),
  );
  const [sort, setSort] = useState<CatalogSort>(() =>
    parseSortParam(searchParams.get("sort")),
  );
  const [page, setPage] = useState(() =>
    Math.max(1, Number(searchParams.get("page") ?? "1") || 1),
  );

  useEffect(() => {
    setFilters(filtersFromSearchParams(searchParams));
    setSort(parseSortParam(searchParams.get("sort")));
    setPage(Math.max(1, Number(searchParams.get("page") ?? "1") || 1));
  }, [searchParams]);

  const bounds = useMemo(() => priceBoundsFromViews(items), [items]);

  const syncUrl = useCallback(
    (nextFilters: CatalogFilters, nextSort: CatalogSort, nextPage: number) => {
      const params = searchParamsFromFilters(
        nextFilters,
        nextSort,
        nextPage,
        preserveQuery ? searchParams.get("q") ?? undefined : undefined,
      );
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, preserveQuery, router, searchParams],
  );

  const result = useMemo(
    () => applyCatalogQuery(items, filters, sort, page),
    [items, filters, sort, page],
  );

  const onFiltersChange = (next: CatalogFilters) => {
    setFilters(next);
    setPage(1);
    syncUrl(next, sort, 1);
    track({
      name: "filter_applied",
      filters: {
        categories: next.categories,
        brands: next.brands,
        minPrice: next.minPrice,
        maxPrice: next.maxPrice,
        minRating: next.minRating,
        inStockOnly: next.inStockOnly,
        sponsored: next.sponsored,
        officialStore: next.officialStore,
        featured: next.featured,
        trending: next.trending,
        flashSale: next.flashSale,
        bestSeller: next.bestSeller,
      },
    });
  };

  const onSortChange = (label: string) => {
    const next = SORT_OPTIONS.find((option) => option.label === label)?.id ?? "relevant";
    setSort(next);
    setPage(1);
    syncUrl(filters, next, 1);
    track({ name: "sort_changed", sort: next });
  };

  const onPageChange = (nextPage: number) => {
    setPage(nextPage);
    syncUrl(filters, sort, nextPage);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const clearFilters = () => {
    const next = emptyFilters();
    setFilters(next);
    setPage(1);
    syncUrl(next, sort, 1);
  };

  const browser = (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {showFilterDrawer ? (
            <FilterDrawer
              categories={categories}
              brands={brands}
              priceBounds={bounds}
              filters={filters}
              onChange={onFiltersChange}
              onReset={clearFilters}
            />
          ) : null}
          <p className="text-[13px] text-muted">
            <span className="font-semibold text-ink">
              {result.total.toLocaleString()}
            </span>{" "}
            products
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Dropdown
            label="Sort"
            options={SORT_OPTIONS.map((option) => option.label)}
            initial={
              SORT_OPTIONS.find((option) => option.id === sort)?.label ??
              SORT_OPTIONS[0].label
            }
            value={
              SORT_OPTIONS.find((option) => option.id === sort)?.label ??
              SORT_OPTIONS[0].label
            }
            onChange={onSortChange}
            className="w-[220px]"
            align="right"
          />
          <div
            className="hidden items-center gap-1 rounded-full border border-line bg-white p-1 sm:flex"
            role="group"
            aria-label="View mode"
          >
            {(
              [
                { id: "grid" as const, icon: LayoutGrid, label: "Grid view" },
                { id: "list" as const, icon: List, label: "List view" },
              ]
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                aria-label={label}
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full transition-colors",
                  view === id ? "bg-ink text-white" : "text-muted hover:bg-soft hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      {showActiveFilters ? (
        <div className="mb-6">
          <ActiveFilters
            filters={filters}
            categories={categories}
            brands={brands}
            onChange={onFiltersChange}
            onClear={clearFilters}
          />
        </div>
      ) : null}

      {!result.items.length ? (
        <CatalogEmpty
          compact={false}
          title="No matching products"
          description="Try clearing filters or broadening your search."
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:gap-5">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {result.items.map((product) => (
            <ProductListCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {showPagination && result.totalPages > 1 ? (
        <Pagination
          current={result.page}
          total={result.totalPages}
          onChange={onPageChange}
          className="mt-10"
        />
      ) : null}
    </div>
  );

  if (!showSidebarFilters) return browser;

  return (
    <div className="grid gap-8 lg:grid-cols-[276px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-28">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Filters</h2>
            <button
              type="button"
              onClick={clearFilters}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Reset
            </button>
          </div>
          <FilterPanel
            categories={categories}
            brands={brands}
            priceBounds={bounds}
            filters={filters}
            onChange={onFiltersChange}
          />
        </div>
      </aside>
      {browser}
    </div>
  );
}
