"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product as ProductView } from "@/lib/data";

const STORAGE_KEY = "shopbeta.recently-viewed.v1";
const MAX_ITEMS = 12;

export type RecentlyViewedItem = Pick<
  ProductView,
  | "id"
  | "slug"
  | "name"
  | "brand"
  | "price"
  | "oldPrice"
  | "rating"
  | "reviews"
  | "stock"
  | "icon"
  | "tone"
  | "thumbnail"
  | "images"
  | "tags"
  | "badge"
  | "category"
  | "subcategory"
  | "shortDescription"
  | "description"
  | "highlights"
  | "specs"
  | "colors"
>;

function readStore(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentlyViewedItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(items: RecentlyViewedItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    setItems(readStore());
  }, []);

  const push = useCallback((product: RecentlyViewedItem) => {
    setItems((current) => {
      const next = [
        product,
        ...current.filter((item) => item.id !== product.id && item.slug !== product.slug),
      ].slice(0, MAX_ITEMS);
      writeStore(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    writeStore([]);
    setItems([]);
  }, []);

  return { items, push, clear, max: MAX_ITEMS };
}
