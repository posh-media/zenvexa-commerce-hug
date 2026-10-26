"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductQuickView } from "./product-quick-view";
import { Eye } from "lucide-react";
import type { Product } from "@/lib/data";
import { cn, discountPercent, formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { ProductMedia } from "@/components/commerce/product-media";
import { WishlistButton } from "@/components/commerce/wishlist-button";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";

export function ProductCard({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const [quickOpen, setQuickOpen] = useState(false);
  const off = discountPercent(product.price, product.oldPrice);

  return (
    <article
      className={cn(
        "zv-product-card group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white p-3 transition-all duration-300 ease-premium hover:-translate-y-1 hover:border-transparent hover:sb-shadow-hover",
        className,
      )}
    >
      <div className="relative">
        <ProductMedia
          icon={product.icon}
          tone={product.tone}
          name={product.name}
          src={product.thumbnail ?? product.images?.[0]}
          className="zv-product-image aspect-square w-full"
          iconClassName="group-hover:scale-110"
        />
        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {off > 0 ? <Badge tone="primary">-{off}%</Badge> : null}
          {product.tags.includes("new") ? <Badge tone="ink">New</Badge> : null}
        </div>
        <WishlistButton
          product={product}
          className="absolute right-2.5 top-2.5"
          size="sm"
        />
        <button
          type="button"
          onClick={() => setQuickOpen(true)}
          className="absolute inset-x-2.5 bottom-2.5 hidden items-center justify-center gap-2 rounded-full bg-white/95 py-2.5 text-[13px] font-medium text-ink opacity-0 backdrop-blur transition-all duration-300 ease-premium group-hover:opacity-100 sm:flex sm:translate-y-2 sm:group-hover:translate-y-0"
        >
          <Eye className="h-4 w-4" aria-hidden />
          Quick view
        </button>
      </div>

      <div className="flex flex-1 flex-col p-2 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {product.brand}
        </p>
        <h3 className="mt-1.5 text-sm font-medium leading-snug tracking-[-0.01em] text-ink">
          <Link
            href={`/product/${product.slug}`}
            className="hover:text-primary"
          >
            <span className="line-clamp-2">{product.name}</span>
          </Link>
        </h3>
        <Rating
          value={product.rating}
          reviews={product.reviews}
          className="mt-2"
        />

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div className="min-w-0">
            <p className="zv-product-price text-[17px] font-semibold tracking-[-0.02em] text-ink">
              {formatPrice(product.price)}
            </p>
            {product.oldPrice ? (
              <p className="text-[13px] text-muted line-through">
                {formatPrice(product.oldPrice)}
              </p>
            ) : null}
          </div>
          <AddToCartButton product={product} variant="icon" />
        </div>
      </div>
      <ProductQuickView
        product={product}
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
      />
    </article>
  );
}

export function ProductListCard({ product }: { product: Product }) {
  const off = discountPercent(product.price, product.oldPrice);
  return (
    <article className="group flex flex-col gap-5 rounded-2xl border border-line bg-white p-4 transition-all duration-300 ease-premium hover:border-transparent hover:sb-shadow-soft sm:flex-row">
      <div className="relative shrink-0">
        <ProductMedia
          icon={product.icon}
          tone={product.tone}
          name={product.name}
          src={product.thumbnail ?? product.images?.[0]}
          className="h-44 w-full sm:h-40 sm:w-40"
        />
        {off > 0 ? (
          <Badge tone="primary" className="absolute left-2.5 top-2.5">
            -{off}%
          </Badge>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          {product.brand} · {product.subcategory}
        </p>
        <h3 className="mt-1.5 text-[17px] font-semibold tracking-[-0.02em] text-ink">
          <Link
            href={`/product/${product.slug}`}
            className="hover:text-primary"
          >
            {product.name}
          </Link>
        </h3>
        <Rating
          value={product.rating}
          reviews={product.reviews}
          className="mt-2"
        />
        <p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-muted">
          {product.shortDescription}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold tracking-[-0.02em] text-ink">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice ? (
              <span className="text-sm text-muted line-through">
                {formatPrice(product.oldPrice)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <WishlistButton product={product} />
            <AddToCartButton product={product} variant="text" />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  items,
  className,
}: {
  items: Product[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5",
        className,
      )}
    >
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function ProductRail({ items }: { items: Product[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible">
      {items.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          className="w-[68%] shrink-0 snap-start sm:w-[44%] lg:w-auto"
        />
      ))}
    </div>
  );
}
