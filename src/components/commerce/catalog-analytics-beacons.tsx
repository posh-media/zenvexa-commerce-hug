"use client";

import { useEffect } from "react";
import { useCatalogAnalytics } from "@/hooks/use-catalog-analytics";

export function TrackSearchPerformed({
  query,
  resultCount,
}: {
  query: string;
  resultCount: number;
}) {
  const { track } = useCatalogAnalytics();
  useEffect(() => {
    if (!query.trim()) return;
    track({
      name: "search_performed",
      query: query.trim(),
      resultCount,
    });
  }, [query, resultCount, track]);
  return null;
}

export function TrackCategoryViewed({
  categoryId,
  slug,
}: {
  categoryId: string;
  slug: string;
}) {
  const { track } = useCatalogAnalytics();
  useEffect(() => {
    track({ name: "category_viewed", categoryId, slug });
  }, [categoryId, slug, track]);
  return null;
}

export function TrackBrandViewed({
  brandId,
  slug,
}: {
  brandId: string;
  slug: string;
}) {
  const { track } = useCatalogAnalytics();
  useEffect(() => {
    track({ name: "brand_viewed", brandId, slug });
  }, [brandId, slug, track]);
  return null;
}
