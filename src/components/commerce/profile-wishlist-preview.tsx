"use client";

import Link from "next/link";
import { ProductCard } from "@/components/commerce/product-card";
import { ButtonLink } from "@/components/ui/button";
import { useWishlistStore } from "@/stores/wishlist.store";
import type { Product } from "@/lib/data";

function asProduct(entry: {
  productId: string;
  slug: string;
  name: string;
  brand?: string;
  thumbnail?: string;
  icon: Product["icon"];
  tone: string;
  price: number;
  oldPrice?: number;
  stock: number;
  rating: number;
  reviews: number;
}): Product {
  return {
    id: entry.productId,
    slug: entry.slug,
    name: entry.name,
    brand: entry.brand ?? "Zenvexa",
    category: "",
    subcategory: "",
    price: entry.price,
    oldPrice: entry.oldPrice,
    rating: entry.rating,
    reviews: entry.reviews,
    stock: entry.stock,
    icon: entry.icon,
    tone: entry.tone,
    tags: [],
    shortDescription: "",
    description: "",
    highlights: [],
    specs: [],
    colors: [],
    images: entry.thumbnail ? [entry.thumbnail] : [],
    thumbnail: entry.thumbnail,
  };
}

export function ProfileWishlistPreview() {
  const items = useWishlistStore((state) => state.items).slice(0, 4);
  const count = useWishlistStore((state) => state.items.length);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">
          Wishlist ({count})
        </h2>
        <Link
          href="/wishlist"
          className="text-[13px] font-medium text-primary hover:underline"
        >
          View all
        </Link>
      </div>
      {items.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((entry) => (
            <ProductCard key={entry.productId} product={asProduct(entry)} />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          Nothing saved yet.{" "}
          <ButtonLink href="/products" variant="ghost" size="sm">
            Browse products
          </ButtonLink>
        </p>
      )}
    </div>
  );
}
