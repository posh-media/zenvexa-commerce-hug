"use client";

import { useEffect } from "react";
import type { Product as ProductView } from "@/lib/data";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { useCatalogAnalytics } from "@/hooks/use-catalog-analytics";
import { ProductCard } from "@/components/commerce/product-card";
import { SectionHeading } from "@/components/ui/card";

function toCardProduct(
  product: Partial<ProductView> & Pick<ProductView, "id" | "slug" | "name">,
): ProductView {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand ?? "Zenvexa",
    category: product.category ?? "Catalogue",
    subcategory: product.subcategory ?? product.category ?? "Catalogue",
    price: product.price ?? 0,
    oldPrice: product.oldPrice,
    rating: product.rating ?? 0,
    reviews: product.reviews ?? 0,
    stock: product.stock ?? 0,
    icon: product.icon ?? "cpu",
    tone: product.tone ?? "bg-[#F4F6FA]",
    badge: product.badge,
    tags: product.tags ?? [],
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    highlights: product.highlights ?? [],
    specs: product.specs ?? [],
    colors: product.colors ?? [],
    images: product.images,
    thumbnail: product.thumbnail,
    categoryId: product.categoryId,
    brandId: product.brandId,
    sku: product.sku,
    sponsored: product.sponsored,
    officialStore: product.officialStore,
    createdAt: product.createdAt,
  };
}

/** Records a product view into local recently-viewed history + analytics. */
export function TrackProductView({
  product,
  categoryId,
  brandId,
}: {
  product: ProductView;
  categoryId?: string;
  brandId?: string;
}) {
  const { push } = useRecentlyViewed();
  const { track } = useCatalogAnalytics();

  useEffect(() => {
    push(product);
    track({
      name: "product_viewed",
      productId: product.id,
      slug: product.slug,
      categoryId,
      brandId,
      price: product.price,
    });
  }, [product, categoryId, brandId, push, track]);

  return null;
}

export function RecentlyViewedRail({
  excludeId,
  title = "Recently viewed",
}: {
  excludeId?: string;
  title?: string;
}) {
  const { items } = useRecentlyViewed();
  const visible = items
    .filter((item) => item.id !== excludeId)
    .slice(0, 4)
    .map(toCardProduct);

  if (!visible.length) return null;

  return (
    <section className="pt-16 sm:pt-20" aria-label={title}>
      <SectionHeading title={title} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
