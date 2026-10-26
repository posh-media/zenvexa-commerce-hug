"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { IconKey } from "@/lib/data";

const ProductGalleryInner = dynamic(
  () =>
    import("@/components/commerce/product-gallery").then(
      (mod) => mod.ProductGallery,
    ),
  {
    loading: () => (
      <div
        className="aspect-square animate-pulse rounded-3xl bg-soft"
        aria-hidden
      />
    ),
  },
);

const ProductPurchasePanelInner = dynamic(
  () =>
    import("@/components/commerce/product-purchase-panel").then(
      (mod) => mod.ProductPurchasePanel,
    ),
  {
    loading: () => (
      <div className="h-40 animate-pulse rounded-2xl bg-soft" aria-hidden />
    ),
  },
);

export function LazyProductGallery(
  props: ComponentProps<typeof ProductGalleryInner> & {
    icon: IconKey;
  },
) {
  return <ProductGalleryInner {...props} />;
}

export function LazyProductPurchasePanel(
  props: ComponentProps<typeof ProductPurchasePanelInner>,
) {
  return <ProductPurchasePanelInner {...props} />;
}
