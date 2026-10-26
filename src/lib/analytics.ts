/**
 * Catalog analytics preparation — no external vendor wiring yet.
 * Call `trackCatalogEvent` from UI; swap the sink later for GA/Segment/etc.
 */

export type CatalogAnalyticsEvent =
  | {
      name: "product_viewed";
      productId: string;
      slug: string;
      categoryId?: string;
      brandId?: string;
      price?: number;
    }
  | {
      name: "product_clicked";
      productId: string;
      slug: string;
      source?: string;
    }
  | {
      name: "search_performed";
      query: string;
      resultCount: number;
    }
  | {
      name: "category_viewed";
      categoryId: string;
      slug: string;
    }
  | {
      name: "brand_viewed";
      brandId: string;
      slug: string;
    }
  | {
      name: "filter_applied";
      filters: Record<string, unknown>;
    }
  | {
      name: "sort_changed";
      sort: string;
    }
  | {
      name: "recommendation_clicked";
      productId: string;
      slug: string;
      rail: string;
    };

type AnalyticsSink = (event: CatalogAnalyticsEvent) => void;

const buffer: CatalogAnalyticsEvent[] = [];
let sink: AnalyticsSink = (event) => {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[catalog-analytics]", event);
  }
  buffer.push(event);
  if (buffer.length > 100) buffer.shift();
};

/** Replace the default sink when an analytics provider is connected. */
export function setCatalogAnalyticsSink(next: AnalyticsSink) {
  sink = next;
}

export function trackCatalogEvent(event: CatalogAnalyticsEvent) {
  try {
    sink(event);
  } catch {
    // Never break UX for analytics failures.
  }
}

export function getBufferedCatalogEvents() {
  return [...buffer];
}

export function clearBufferedCatalogEvents() {
  buffer.length = 0;
}
