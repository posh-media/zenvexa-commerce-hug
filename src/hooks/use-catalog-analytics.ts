"use client";

import { useCallback } from "react";
import {
  trackCatalogEvent,
  type CatalogAnalyticsEvent,
} from "@/lib/analytics";

/** Thin client hook so components never import the sink directly. */
export function useCatalogAnalytics() {
  const track = useCallback((event: CatalogAnalyticsEvent) => {
    trackCatalogEvent(event);
  }, []);

  return { track };
}
