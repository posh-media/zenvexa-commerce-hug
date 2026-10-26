"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  LayoutGrid,
  Package,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { buildSearchSuggestions } from "@/lib/search";
import { cn } from "@/lib/utils";
import { toProductViews } from "@/lib/product-view";
import { searchProducts } from "@/services/products.service";
import { upsertUserProfile } from "@/services/users.service";
import { useCatalogNav } from "@/providers/catalog-nav-provider";
import { useSearchStore } from "@/stores/search.store";
import { useUserStore } from "@/stores/user.store";

export function SearchBar({
  placeholder = "Search laptops, phones, gaming, smart home…",
  className,
  withSuggestions = true,
  size = "md",
  initialQuery = "",
  suggestions = [],
}: {
  placeholder?: string;
  className?: string;
  withSuggestions?: boolean;
  size?: "md" | "lg";
  initialQuery?: string;
  /** Popular search terms from the catalogue. */
  suggestions?: string[];
}) {
  const router = useRouter();
  const listId = "search-suggestions";
  const [value, setValue] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [productHits, setProductHits] = useState<
    ReturnType<typeof toProductViews>
  >([]);
  const debounced = useDebouncedValue(value, 280);
  const recent = useSearchStore((state) => state.recent);
  const pushRecent = useSearchStore((state) => state.pushRecent);
  const authUser = useUserStore((state) => state.authUser);
  const status = useUserStore((state) => state.status);
  const { categories, brands, popularSearches } = useCatalogNav();
  const popular = suggestions.length ? suggestions : popularSearches;
  const blurTimer = useRef<number | null>(null);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.trim()) {
      setProductHits([]);
      return;
    }
    void searchProducts(debounced, 6)
      .then((products) => {
        if (!cancelled) setProductHits(toProductViews(products));
      })
      .catch(() => {
        if (!cancelled) setProductHits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const suggestionItems = useMemo(
    () =>
      buildSearchSuggestions({
        query: debounced,
        recent,
        popular,
        categories,
        brands,
        products: productHits,
        limit: 10,
      }),
    [brands, categories, debounced, popular, productHits, recent],
  );

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestionItems]);

  const persistHistory = (term: string) => {
    pushRecent(term);
    if (status === "authenticated" && authUser) {
      const next = [
        term,
        ...recent.filter((item) => item.toLowerCase() !== term.toLowerCase()),
      ].slice(0, 10);
      void upsertUserProfile(authUser.uid, { searchHistory: next }).catch(
        () => undefined,
      );
    }
  };

  const go = (term: string) => {
    const query = term.trim();
    if (query) persistHistory(query);
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
    setFocused(false);
  };

  const activateSuggestion = (index: number) => {
    const item = suggestionItems[index];
    if (!item) return;
    if (item.kind === "product" || item.kind === "category" || item.kind === "brand") {
      if (item.kind !== "product") persistHistory(item.label);
      router.push(item.href);
      setFocused(false);
      return;
    }
    go(item.label);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (activeIndex >= 0) {
      activateSuggestion(activeIndex);
      return;
    }
    go(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!withSuggestions || !focused || !suggestionItems.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        index < suggestionItems.length - 1 ? index + 1 : 0,
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestionItems.length - 1 : index - 1,
      );
    } else if (event.key === "Escape") {
      setFocused(false);
      setActiveIndex(-1);
    }
  };

  const iconFor = (kind: string) => {
    if (kind === "category") return LayoutGrid;
    if (kind === "brand") return Building2;
    if (kind === "product") return Package;
    if (kind === "popular") return TrendingUp;
    return Search;
  };

  return (
    <form className={cn("relative", className)} onSubmit={onSubmit} role="search">
      <div
        className={cn(
          "flex items-center gap-3 rounded-full border bg-white pl-5 pr-2 transition-all duration-200",
          size === "lg" ? "h-14" : "h-12",
          focused
            ? "border-primary ring-4 ring-primary-100"
            : "border-line hover:border-ink/20",
        )}
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setFocused(false), 150);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search products"
          aria-expanded={withSuggestions && focused}
          aria-controls={withSuggestions ? listId : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setValue("")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <button
          type="submit"
          className={cn(
            "hidden shrink-0 items-center justify-center rounded-full bg-primary px-5 text-[13px] font-medium text-white transition-colors hover:bg-primary-600 sm:inline-flex",
            size === "lg" ? "h-11" : "h-9",
          )}
        >
          Search
        </button>
      </div>

      {withSuggestions && focused ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="sb-fade-up absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-line bg-white p-2 sb-shadow-soft"
        >
          {!suggestionItems.length ? (
            <p className="px-3 py-4 text-[13px] text-muted">
              {debounced
                ? `No suggestions for “${debounced}”. Press Enter to search.`
                : "Start typing to search products, brands and categories."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {suggestionItems.map((item, index) => {
                const Icon = iconFor(item.kind);
                const active = index === activeIndex;
                return (
                  <li key={item.id} role="option" aria-selected={active}>
                    <button
                      id={`${listId}-option-${index}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => activateSuggestion(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-primary-50 text-primary-700"
                          : "text-ink-soft hover:bg-soft",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.secondary ? (
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-muted">
                          {item.secondary}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.08em] text-muted">
                          {item.kind}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {popular.length && !debounced ? (
            <div className="mt-2 border-t border-line px-2 pb-2 pt-3">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                Trending now
              </p>
              <div className="flex flex-wrap gap-2">
                {popular.slice(0, 5).map((item) => (
                  <Link
                    key={item}
                    href={`/search?q=${encodeURIComponent(item)}`}
                    onMouseDown={(event) => event.preventDefault()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-soft transition-colors hover:border-primary-200 hover:text-primary"
                  >
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
