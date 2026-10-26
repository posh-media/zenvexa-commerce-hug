import type { Product as ProductView } from "@/lib/data";
import type { CartLine } from "@/lib/cart";
import type { WishlistEntry } from "@/lib/wishlist";

/** Build a cart line snapshot from the UI product view model. */
export function cartLineFromProduct(
  product: ProductView,
  options?: { quantity?: number; variation?: string },
): CartLine {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    thumbnail: product.thumbnail ?? product.images?.[0],
    icon: product.icon,
    tone: product.tone,
    price: product.price,
    oldPrice: product.oldPrice,
    stock: product.stock,
    quantity: options?.quantity ?? 1,
    variation: options?.variation,
    subcategory: product.subcategory,
  };
}

export function wishlistEntryFromProduct(
  product: ProductView,
): WishlistEntry {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    thumbnail: product.thumbnail ?? product.images?.[0],
    icon: product.icon,
    tone: product.tone,
    price: product.price,
    oldPrice: product.oldPrice,
    stock: product.stock,
    rating: product.rating,
    reviews: product.reviews,
    addedAt: new Date().toISOString(),
  };
}
