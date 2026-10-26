"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/data";
import { cartLineFromProduct } from "@/lib/commerce-adapters";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { WishlistButton } from "@/components/commerce/wishlist-button";
import { useCartStore } from "@/stores/cart.store";
import { toastError, toastSuccess } from "@/stores/toast.store";

export function ProductPurchasePanel({ product }: { product: Product }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const colors = product.colors.length ? product.colors : ["Default"];
  const [variation, setVariation] = useState(colors[0]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const max = Math.max(product.stock, 0);

  const canPurchase = max > 0;

  const line = useMemo(
    () => cartLineFromProduct(product, { quantity, variation }),
    [product, quantity, variation],
  );

  const addToCart = () => {
    const result = addItem(line);
    if (!result.ok) {
      const reason = result.reason ?? "Could not add to cart.";
      setError(reason);
      toastError("Could not add to cart", reason);
      return false;
    }
    setError(null);
    toastSuccess("Added to cart", product.name);
    return true;
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      // User cancelled or clipboard unavailable.
    }
  };

  return (
    <div>
      <div className="mt-7">
        <p className="mb-2.5 text-[13px] font-medium text-ink">
          Colour: <span className="text-muted">{variation}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              aria-pressed={variation === color}
              onClick={() => setVariation(color)}
              className={
                variation === color
                  ? "rounded-full border border-primary bg-primary-50 px-4 py-2 text-[13px] font-medium text-primary-700"
                  : "rounded-full border border-line bg-white px-4 py-2 text-[13px] text-ink-soft transition-colors hover:border-ink/25"
              }
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <QuantitySelector
          value={quantity}
          max={Math.max(max, 1)}
          onChange={setQuantity}
        />
        <Button
          className="min-w-[180px] flex-1"
          size="lg"
          disabled={!canPurchase}
          onClick={() => addToCart()}
        >
          <ShoppingCart className="h-[18px] w-[18px]" aria-hidden />
          {canPurchase ? "Add to cart" : "Out of stock"}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          disabled={!canPurchase}
          onClick={() => {
            if (addToCart()) router.push("/checkout");
          }}
        >
          Buy now
        </Button>
        <WishlistButton product={product} size="lg" />
        <button
          type="button"
          aria-label="Share this product"
          onClick={share}
          className="grid h-12 w-12 place-items-center rounded-full border border-line bg-white text-ink transition-colors hover:bg-soft"
        >
          <Share2 className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-[13px] text-primary" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
