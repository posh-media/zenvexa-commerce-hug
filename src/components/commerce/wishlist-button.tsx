"use client";

import { Heart } from "lucide-react";
import type { Product } from "@/lib/data";
import { wishlistEntryFromProduct } from "@/lib/commerce-adapters";
import { cn } from "@/lib/utils";
import { toastInfo, toastSuccess } from "@/stores/toast.store";
import { useWishlistStore } from "@/stores/wishlist.store";

export function WishlistButton({
  product,
  productId,
  initial = false,
  label = "Save to wishlist",
  className,
  size = "md",
}: {
  /** Preferred: full product for snapshot persistence. */
  product?: Product;
  /** Fallback id when only toggling known membership. */
  productId?: string;
  initial?: boolean;
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const id = product?.id ?? productId ?? "";
  const saved = useWishlistStore((state) =>
    id ? state.items.some((item) => item.productId === id) : initial,
  );
  const toggleItem = useWishlistStore((state) => state.toggleItem);
  const removeItem = useWishlistStore((state) => state.removeItem);

  const dims = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" }[size];
  const icon = { sm: "h-4 w-4", md: "h-[18px] w-[18px]", lg: "h-5 w-5" }[size];

  const handleClick = () => {
    if (!id) return;
    if (product) {
      const wasSaved = saved;
      toggleItem(wishlistEntryFromProduct(product));
      if (wasSaved) {
        toastInfo("Removed from wishlist", product.name);
      } else {
        toastSuccess("Saved to wishlist", product.name);
      }
      return;
    }
    if (saved) {
      removeItem(id);
      toastInfo("Removed from wishlist");
    }
  };

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : label}
      title={saved ? "Saved to wishlist" : label}
      onClick={handleClick}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border bg-white/90 backdrop-blur transition-all duration-200 ease-premium active:scale-90",
        dims,
        saved
          ? "border-primary-200 text-primary"
          : "border-line text-ink hover:border-primary-200 hover:text-primary",
        className,
      )}
    >
      <Heart className={cn(icon, saved && "fill-primary")} aria-hidden />
    </button>
  );
}
