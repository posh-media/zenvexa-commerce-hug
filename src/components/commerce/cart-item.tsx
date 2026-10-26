"use client";

import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";
import type { CartLine } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { ProductMedia } from "@/components/commerce/product-media";
import { useCartStore } from "@/stores/cart.store";
import { toastInfo, toastSuccess } from "@/stores/toast.store";
import { useWishlistStore } from "@/stores/wishlist.store";

export function CartItemRow({ line }: { line: CartLine }) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const addWishlist = useWishlistStore((state) => state.addItem);

  return (
    <article className="flex gap-4 py-5 first:pt-0 last:pb-0">
      <Link href={`/product/${line.slug}`} className="shrink-0">
        <ProductMedia
          icon={line.icon}
          tone={line.tone}
          name={line.name}
          src={line.thumbnail}
          className="h-24 w-24 sm:h-28 sm:w-28"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              {line.brand}
            </p>
            <h3 className="mt-1 text-[15px] font-medium leading-snug tracking-[-0.01em] text-ink">
              <Link href={`/product/${line.slug}`} className="hover:text-primary">
                {line.name}
              </Link>
            </h3>
            <p className="mt-1.5 text-[13px] text-muted">
              {line.variation ?? "Default"}
              {line.subcategory ? ` · ${line.subcategory}` : ""}
            </p>
            <div className="mt-2">
              {line.stock > 5 ? (
                <Badge tone="success">In stock</Badge>
              ) : line.stock > 0 ? (
                <Badge tone="warning">Only {line.stock} left</Badge>
              ) : (
                <Badge tone="warning">Out of stock</Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
              {formatPrice(line.price * line.quantity)}
            </p>
            {line.oldPrice ? (
              <p className="text-[13px] text-muted line-through">
                {formatPrice(line.oldPrice * line.quantity)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <QuantitySelector
            value={line.quantity}
            size="sm"
            max={Math.max(line.stock, 1)}
            onChange={(qty) =>
              setQuantity(line.productId, qty, line.variation)
            }
          />
          <button
            type="button"
            onClick={() => {
              addWishlist({
                productId: line.productId,
                slug: line.slug,
                name: line.name,
                brand: line.brand,
                thumbnail: line.thumbnail,
                icon: line.icon,
                tone: line.tone,
                price: line.price,
                oldPrice: line.oldPrice,
                stock: line.stock,
                rating: 0,
                reviews: 0,
              });
              removeItem(line.productId, line.variation);
              toastSuccess("Saved for later", line.name);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-soft"
          >
            <Bookmark className="h-4 w-4" aria-hidden />
            Save for later
          </button>
          <button
            type="button"
            onClick={() => {
              removeItem(line.productId, line.variation);
              toastInfo("Removed from cart", line.name);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted transition-colors hover:bg-primary-50 hover:text-primary"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
