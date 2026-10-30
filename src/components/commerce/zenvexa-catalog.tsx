"use client";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Zap } from "lucide-react";
import type { Product } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import { ProductGrid } from "./product-card";
import { CatalogEmpty } from "./catalog-state";
import { prioritizeRealImages } from "@/lib/product-image";
import { categorySections } from "@/lib/category-sections";

/** Display-only filters over ShopBeta's active product views. Checkout keeps its authoritative pricing. */
export function ZenvexaCatalog({ items, categories = [] }: {
  items: Product[];
  categories?: { id: string; name: string; slug: string }[];
}) {
  const [grouped, setGrouped] = useState(true);
  const ceiling = Math.max(20000, ...items.map((p) => p.price));
  const [search, setSearch] = useState("");
  const [budget, setBudget] = useState(ceiling);
  const [deals, setDeals] = useState(false);
  const [sort, setSort] = useState("featured");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const result = items.filter(
      (p) =>
        (!query ||
          `${p.name} ${p.brand} ${p.category}`
            .toLocaleLowerCase()
            .includes(query)) &&
        p.price <= budget &&
        (!deals || (p.oldPrice ?? 0) > p.price),
    );
    if (sort === "low") result.sort((a, b) => a.price - b.price);
    if (sort === "high") result.sort((a, b) => b.price - a.price);
    if (sort === "rating") result.sort((a, b) => b.rating - a.rating);
    return prioritizeRealImages(result);
  }, [items, search, budget, deals, sort]);
  return (
    <>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3">
        <Search size={16} />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          aria-label="Filter everyday merchandise"
          placeholder="Find your next everyday favourite…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="mb-4 flex gap-3" role="group" aria-label="Merchandise view">
        <button className={`category-pill${grouped ? " selected" : ""}`} aria-pressed={grouped} onClick={() => setGrouped(true)}>Browse by category</button>
        <button className={`category-pill${!grouped ? " selected" : ""}`} aria-pressed={!grouped} onClick={() => setGrouped(false)}>All merchandise</button>
      </div>
      <div className="filters">
        <span className="filter-count">
          Showing <b>{filtered.length}</b> of {items.length} products
        </span>
        <div className="filter-controls">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={deals}
              onChange={(e) => setDeals(e.target.checked)}
            />
            <Zap size={12} />
            Awoof Discounts Only
          </label>
          <label className="budget-control">
            Max budget
            <input
              aria-label="Maximum Naira budget"
              type="range"
              min={0}
              max={ceiling}
              step={Math.max(1, Math.round(ceiling / 200))}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
            <strong>{formatPrice(budget)}</strong>
          </label>
          <select
            className="sort-select"
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="featured">Featured Hug Picks</option>
            <option value="low">Price: Low to High</option>
            <option value="high">Price: High to Low</option>
            <option value="rating">Highest Customer Rating</option>
          </select>
        </div>
      </div>
      {filtered.length ? (
        grouped ? categorySections(filtered, categories).map((section) => (
          <section key={section.id} className="mb-8" aria-label={section.name}>
            <h3 className="mb-4 text-xl font-semibold">{section.name}</h3>
            <ProductGrid items={section.items} />
          </section>
        )) : <ProductGrid items={filtered} />
      ) : (
        <>
          <CatalogEmpty
            title="No hugs found just yet"
            description="Try a different search or give your budget a little more room."
          />
          <button
            className="zv-button primary my-4"
            onClick={() => {
              setSearch("");
              setBudget(ceiling);
              setDeals(false);
              setSort("featured");
            }}
          >
            Reset filters
            <SlidersHorizontal size={16} />
          </button>
        </>
      )}
    </>
  );
}
