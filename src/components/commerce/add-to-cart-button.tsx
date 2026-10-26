"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import type { Product } from "@/lib/data";
import { cartLineFromProduct } from "@/lib/commerce-adapters";
import { useCartStore } from "@/stores/cart.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import { cn } from "@/lib/utils";

export function AddToCartButton({
  product,
  quantity = 1,
  variation,
  label = "Add to cart",
  variant = "icon",
  className,
  onAdded,
}: {
  product: Product;
  quantity?: number;
  variation?: string;
  label?: string;
  variant?: "icon" | "button" | "text";
  className?: string;
  onAdded?: () => void;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    setPending(true);
    const result = addItem(
      cartLineFromProduct(product, { quantity, variation }),
    );
    setPending(false);
    if (!result.ok) {
      const reason = result.reason ?? "Could not add to cart.";
      setMessage(reason);
      toastError("Could not add to cart", reason);
      return;
    }
    setMessage(null);
    toastSuccess("Added to cart", product.name);
    onAdded?.();
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        aria-label={`Add ${product.name} to cart`}
        disabled={pending || product.stock <= 0}
        onClick={handleClick}
        title={message ?? undefined}
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white transition-all duration-200 ease-premium hover:bg-primary active:scale-90 disabled:opacity-40 sm:group-hover:bg-primary",
          className,
        )}
      >
        <ShoppingCart className="h-[18px] w-[18px]" aria-hidden />
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        disabled={pending || product.stock <= 0}
        onClick={handleClick}
        className={
          variant === "text"
            ? "inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-primary disabled:opacity-40"
            : "inline-flex h-12 min-w-[180px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[15px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(20,92,67,0.35)] transition-all duration-200 ease-premium hover:bg-primary-600 active:scale-[0.985] disabled:opacity-40"
        }
      >
        <ShoppingCart className="h-[18px] w-[18px]" aria-hidden />
        {product.stock <= 0 ? "Out of stock" : label}
      </button>
      {message ? (
        <p className="text-[12px] text-primary" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
