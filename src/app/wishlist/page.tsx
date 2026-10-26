"use client";

import { Share2, ShoppingCart, Trash2 } from "lucide-react";
import { discountPercent, formatPrice } from "@/lib/utils";
import { cartLineFromProduct } from "@/lib/commerce-adapters";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rating } from "@/components/ui/rating";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyHeartIllustration } from "@/components/ui/illustrations";
import { ProductMedia } from "@/components/commerce/product-media";
import { WishlistButton } from "@/components/commerce/wishlist-button";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import type { Product } from "@/lib/data";

function entryAsProduct(entry: {
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

export default function WishlistPage() {
  const items = useWishlistStore((state) => state.items);
  const hydrated = useWishlistStore((state) => state.hydrated);
  const removeItem = useWishlistStore((state) => state.removeItem);
  const clearWishlist = useWishlistStore((state) => state.clear);
  const addItem = useCartStore((state) => state.addItem);

  if (!hydrated) {
    return (
      <div className="sb-container py-16 text-center text-sm text-muted">
        Loading wishlist…
      </div>
    );
  }

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Wishlist" }]}
        title="Wishlist"
        description={
          items.length
            ? `${items.length} saved item${items.length === 1 ? "" : "s"}.`
            : "Nothing saved yet."
        }
        action={
          items.length ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearWishlist()}
              >
                Clear wishlist
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4" aria-hidden />
                Share wishlist
              </Button>
            </div>
          ) : undefined
        }
      />

      {!items.length ? (
        <EmptyState
          illustration={<EmptyHeartIllustration />}
          title="Nothing saved yet"
          description="Tap the heart on any product to keep it here and get alerted when the price drops."
          actions={
            <>
              <ButtonLink href="/products">Browse products</ButtonLink>
              <ButtonLink href="/deals" variant="outline">
                See today&apos;s deals
              </ButtonLink>
            </>
          }
        />
      ) : (
        <div className="space-y-4">
          {items.map((entry) => {
            const product = entryAsProduct(entry);
            const off = discountPercent(entry.price, entry.oldPrice);
            return (
              <article
                key={entry.productId}
                className="group flex flex-col gap-5 rounded-2xl border border-line bg-white p-4 transition-all duration-300 ease-premium hover:border-transparent hover:sb-shadow-soft sm:flex-row sm:items-center"
              >
                <div className="relative shrink-0">
                  <ProductMedia
                    icon={entry.icon}
                    tone={entry.tone}
                    name={entry.name}
                    src={entry.thumbnail}
                    className="h-40 w-full sm:h-28 sm:w-28"
                    iconClassName="group-hover:scale-110"
                  />
                  {off > 0 ? (
                    <Badge tone="primary" className="absolute left-2 top-2">
                      -{off}%
                    </Badge>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                    {entry.brand}
                  </p>
                  <h2 className="mt-1.5 text-[16px] font-medium tracking-[-0.01em] text-ink">
                    {entry.name}
                  </h2>
                  <Rating
                    value={entry.rating}
                    reviews={entry.reviews}
                    className="mt-2"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    {entry.stock > 5 ? (
                      <Badge tone="success">In stock</Badge>
                    ) : entry.stock > 0 ? (
                      <Badge tone="warning">Only {entry.stock} left</Badge>
                    ) : (
                      <Badge tone="warning">Out of stock</Badge>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                  <div className="text-left sm:text-right">
                    <p className="text-xl font-semibold tracking-[-0.02em] text-ink">
                      {formatPrice(entry.price)}
                    </p>
                    {entry.oldPrice ? (
                      <p className="text-[13px] text-muted line-through">
                        {formatPrice(entry.oldPrice)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <WishlistButton product={product} />
                    <button
                      type="button"
                      aria-label={`Remove ${entry.name} from wishlist`}
                      onClick={() => removeItem(entry.productId)}
                      className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:border-primary-200 hover:text-primary"
                    >
                      <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                    <Button
                      size="sm"
                      disabled={entry.stock <= 0}
                      onClick={() => {
                        addItem(cartLineFromProduct(product));
                        removeItem(entry.productId);
                      }}
                    >
                      <ShoppingCart className="h-4 w-4" aria-hidden />
                      Move to cart
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
