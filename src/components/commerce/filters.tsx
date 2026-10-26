"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, Star, X } from "lucide-react";
import type { Brand, Category } from "@/lib/data";
import type { CatalogFilters } from "@/lib/catalog-query";
import { emptyFilters } from "@/lib/catalog-query";
import { cn, formatPrice } from "@/lib/utils";
import { Checkbox } from "@/components/ui/field";
import { Chip } from "@/components/ui/badge";

function Group({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-line py-5 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
        {title}
        <span className="text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="pt-4">{children}</div>
    </details>
  );
}

function toggleValue(list: string[], value: string) {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

export function FilterPanel({
  className,
  categories = [],
  brands = [],
  priceBounds = { min: 0, max: 0 },
  filters,
  onChange,
}: {
  className?: string;
  categories?: Category[];
  brands?: Brand[];
  priceBounds?: { min: number; max: number };
  filters?: CatalogFilters;
  onChange?: (filters: CatalogFilters) => void;
}) {
  const value = filters ?? emptyFilters();
  const update = (patch: Partial<CatalogFilters>) => {
    onChange?.({ ...value, ...patch });
  };

  const maxCeiling = Math.max(priceBounds.max, priceBounds.min + 1);
  const currentMax = value.maxPrice ?? maxCeiling;

  return (
    <div className={cn("rounded-2xl border border-line bg-white px-5 py-1", className)}>
      <Group title="Category">
        <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
          {categories.slice(0, 12).map((category) => (
            <Checkbox
              key={category.slug}
              label={category.name}
              count={category.itemCount}
              checked={value.categories.includes(category.slug)}
              onChange={() =>
                update({ categories: toggleValue(value.categories, category.slug) })
              }
            />
          ))}
        </div>
      </Group>
      <Group title="Brand">
        <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
          {brands.slice(0, 16).map((brand) => (
            <Checkbox
              key={brand.slug}
              label={brand.name}
              count={brand.productCount}
              checked={value.brands.includes(brand.slug)}
              onChange={() =>
                update({ brands: toggleValue(value.brands, brand.slug) })
              }
            />
          ))}
        </div>
      </Group>
      <Group title="Price">
        <div>
          <div className="mb-3 flex items-center justify-between text-[13px] text-muted">
            <span>{formatPrice(priceBounds.min)}</span>
            <span className="font-semibold text-ink">
              Up to {formatPrice(currentMax)}
            </span>
          </div>
          <input
            type="range"
            min={priceBounds.min}
            max={maxCeiling}
            step={Math.max(1, Math.round((maxCeiling - priceBounds.min) / 40))}
            value={currentMax}
            onChange={(event) => update({ maxPrice: Number(event.target.value) })}
            aria-label="Maximum price"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <input
              type="number"
              value={value.minPrice ?? priceBounds.min}
              onChange={(event) =>
                update({
                  minPrice: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              aria-label="Minimum price"
              className="h-10 rounded-xl border border-line px-3 text-sm text-ink outline-none focus:border-primary"
            />
            <input
              type="number"
              value={currentMax}
              onChange={(event) =>
                update({
                  maxPrice: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
              aria-label="Maximum price"
              className="h-10 rounded-xl border border-line px-3 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
        </div>
      </Group>
      <Group title="Customer rating">
        <div className="space-y-0.5">
          {[4, 3, 2].map((stars) => (
            <Checkbox
              key={stars}
              checked={value.minRating === stars}
              onChange={() =>
                update({
                  minRating: value.minRating === stars ? undefined : stars,
                })
              }
              label={
                <span className="flex items-center gap-1.5">
                  <span className="flex">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={cn(
                          "h-3.5 w-3.5",
                          index < stars
                            ? "fill-amber-400 text-amber-400"
                            : "fill-line text-line",
                        )}
                        aria-hidden
                      />
                    ))}
                  </span>
                  <span className="text-[13px]">& up</span>
                </span>
              }
            />
          ))}
        </div>
      </Group>
      <Group title="Availability">
        <div className="space-y-0.5">
          <Checkbox
            label="In stock"
            checked={value.inStockOnly}
            onChange={() => update({ inStockOnly: !value.inStockOnly })}
          />
        </div>
      </Group>
      <Group title="Highlights" defaultOpen={false}>
        <div className="space-y-0.5">
          <Checkbox
            label="Sponsored"
            checked={value.sponsored}
            onChange={() => update({ sponsored: !value.sponsored })}
          />
          <Checkbox
            label="Official store"
            checked={value.officialStore}
            onChange={() => update({ officialStore: !value.officialStore })}
          />
          <Checkbox
            label="Featured"
            checked={value.featured}
            onChange={() => update({ featured: !value.featured })}
          />
          <Checkbox
            label="Trending"
            checked={value.trending}
            onChange={() => update({ trending: !value.trending })}
          />
          <Checkbox
            label="Flash sale"
            checked={value.flashSale}
            onChange={() => update({ flashSale: !value.flashSale })}
          />
          <Checkbox
            label="Best seller"
            checked={value.bestSeller}
            onChange={() => update({ bestSeller: !value.bestSeller })}
          />
        </div>
      </Group>
    </div>
  );
}

export function ActiveFilters({
  filters,
  categories = [],
  brands = [],
  onChange,
  onClear,
}: {
  filters: CatalogFilters;
  categories?: Category[];
  brands?: Brand[];
  onChange: (filters: CatalogFilters) => void;
  onClear: () => void;
}) {
  const chips = useMemo(() => {
    const items: Array<{ key: string; label: string; clear: () => void }> = [];
    for (const slug of filters.categories) {
      const category = categories.find((item) => item.slug === slug);
      items.push({
        key: `cat-${slug}`,
        label: category?.name ?? slug,
        clear: () =>
          onChange({
            ...filters,
            categories: filters.categories.filter((value) => value !== slug),
          }),
      });
    }
    for (const slug of filters.brands) {
      const brand = brands.find((item) => item.slug === slug);
      items.push({
        key: `brand-${slug}`,
        label: brand?.name ?? slug,
        clear: () =>
          onChange({
            ...filters,
            brands: filters.brands.filter((value) => value !== slug),
          }),
      });
    }
    if (filters.maxPrice != null) {
      items.push({
        key: "max-price",
        label: `Under ${formatPrice(filters.maxPrice)}`,
        clear: () => onChange({ ...filters, maxPrice: undefined }),
      });
    }
    if (filters.minRating != null) {
      items.push({
        key: "rating",
        label: `${filters.minRating}+ stars`,
        clear: () => onChange({ ...filters, minRating: undefined }),
      });
    }
    if (filters.inStockOnly) {
      items.push({
        key: "stock",
        label: "In stock",
        clear: () => onChange({ ...filters, inStockOnly: false }),
      });
    }
    if (filters.sponsored) {
      items.push({
        key: "sponsored",
        label: "Sponsored",
        clear: () => onChange({ ...filters, sponsored: false }),
      });
    }
    if (filters.officialStore) {
      items.push({
        key: "official",
        label: "Official store",
        clear: () => onChange({ ...filters, officialStore: false }),
      });
    }
    if (filters.featured) {
      items.push({
        key: "featured",
        label: "Featured",
        clear: () => onChange({ ...filters, featured: false }),
      });
    }
    if (filters.trending) {
      items.push({
        key: "trending",
        label: "Trending",
        clear: () => onChange({ ...filters, trending: false }),
      });
    }
    if (filters.flashSale) {
      items.push({
        key: "flash",
        label: "Flash sale",
        clear: () => onChange({ ...filters, flashSale: false }),
      });
    }
    if (filters.bestSeller) {
      items.push({
        key: "best",
        label: "Best seller",
        clear: () => onChange({ ...filters, bestSeller: false }),
      });
    }
    return items;
  }, [filters, categories, brands, onChange]);

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-muted">Active:</span>
      {chips.map((chip) => (
        <Chip key={chip.key} onRemove={chip.clear} onClick={chip.clear}>
          {chip.label}
        </Chip>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="text-[13px] font-medium text-primary hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

export function FilterDrawer({
  categories,
  brands,
  priceBounds,
  filters,
  onChange,
  onReset,
}: {
  categories: Category[];
  brands: Brand[];
  priceBounds: { min: number; max: number };
  filters: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-soft lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Filters
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[80] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Product filters"
        >
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <p className="text-[15px] font-semibold text-ink" id="filter-drawer-title">
                Filters
              </p>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-line text-muted"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FilterPanel
                className="border-0 px-0"
                categories={categories}
                brands={brands}
                priceBounds={priceBounds}
                filters={filters}
                onChange={onChange}
              />
            </div>
            <div className="flex gap-3 border-t border-line p-4">
              <button
                type="button"
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
                className="h-12 flex-1 rounded-full border border-line text-sm font-medium text-ink"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-12 flex-1 rounded-full bg-primary text-sm font-medium text-white"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
