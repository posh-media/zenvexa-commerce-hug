import type { IconKey } from "@/lib/data";

/** Guest-persisted wishlist entry with display snapshot. */
export type WishlistEntry = {
  productId: string;
  slug: string;
  name: string;
  brand?: string;
  thumbnail?: string;
  icon: IconKey;
  tone: string;
  price: number;
  oldPrice?: number;
  stock: number;
  rating: number;
  reviews: number;
  addedAt?: string;
};

export function wishlistHas(
  items: WishlistEntry[],
  productId: string,
): boolean {
  return items.some((item) => item.productId === productId);
}
