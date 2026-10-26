"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { Product } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { ProductMedia } from "./product-media";
import { Rating } from "@/components/ui/rating";
export function ProductQuickView({
  product,
  open,
  onClose,
}: {
  product: Product;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={product.name}
      className="m-auto max-h-[90dvh] w-[calc(100%-32px)] max-w-3xl overflow-y-auto rounded-lg border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-ink/50"
    >
      <div className="mb-4 flex justify-end">
        <button
          className="zv-button"
          aria-label="Close product preview"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <ProductMedia
          icon={product.icon}
          tone={product.tone}
          name={product.name}
          src={product.thumbnail ?? product.images?.[0]}
          className="aspect-square w-full"
        />
        <div>
          <p className="text-xs font-semibold text-primary">{product.brand}</p>
          <h2 className="my-3 text-2xl font-bold">{product.name}</h2>
          <p className="mb-3 text-sm text-muted">{product.shortDescription}</p>
          <Rating value={product.rating} reviews={product.reviews} />
          <div className="my-4 flex items-center gap-3">
            <strong className="text-2xl text-primary">
              {formatPrice(product.price)}
            </strong>
            {product.oldPrice && (
              <del className="text-sm text-muted">
                {formatPrice(product.oldPrice)}
              </del>
            )}
          </div>
          <ul className="mb-5 space-y-2">
            {product.highlights.map((h) => (
              <li key={h} className="flex gap-2 text-xs">
                <Check className="shrink-0 text-primary" size={14} />
                {h}
              </li>
            ))}
          </ul>
          <p className="mb-4 text-xs text-muted">
            {product.stock} available
            {product.sku ? ` · SKU: ${product.sku}` : ""}
          </p>
          {product.colors.length ? (
            <Link
              className="zv-button primary"
              href={`/product/${product.slug}`}
            >
              Choose product options
            </Link>
          ) : (
            <AddToCartButton
              product={product}
              variant="button"
              label="Add to Hug Bag"
            />
          )}
          <Link
            className="mt-4 block text-xs text-primary underline"
            href={`/product/${product.slug}`}
          >
            View full product details
          </Link>
        </div>
      </div>
    </dialog>
  );
}
