"use client";

import Link from "next/link";
import type { Product as ProductView } from "@/lib/data";
import { useCatalogAnalytics } from "@/hooks/use-catalog-analytics";
import { ProductCard } from "@/components/commerce/product-card";

/** Wraps a product card click for analytics without changing card visuals. */
export function TrackableProductCard({
  product,
  source,
  rail,
  className,
}: {
  product: ProductView;
  source?: string;
  rail?: string;
  className?: string;
}) {
  const { track } = useCatalogAnalytics();

  return (
    <div
      className={className}
      onClickCapture={() => {
        track({
          name: "product_clicked",
          productId: product.id,
          slug: product.slug,
          source,
        });
        if (rail) {
          track({
            name: "recommendation_clicked",
            productId: product.id,
            slug: product.slug,
            rail,
          });
        }
      }}
    >
      <ProductCard product={product} />
    </div>
  );
}

export function TrackableProductLink({
  href,
  productId,
  slug,
  source,
  children,
  className,
}: {
  href: string;
  productId: string;
  slug: string;
  source?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { track } = useCatalogAnalytics();
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        track({
          name: "product_clicked",
          productId,
          slug,
          source,
        })
      }
    >
      {children}
    </Link>
  );
}
