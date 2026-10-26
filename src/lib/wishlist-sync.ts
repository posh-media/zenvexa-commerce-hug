import type { WishlistEntry } from "@/lib/wishlist";
import { getWishlist, setWishlist } from "@/services/wishlists.service";
import { useWishlistStore } from "@/stores/wishlist.store";

/**
 * Merge guest local wishlist with the authenticated user's Firestore wishlist.
 * Product snapshots from local entries win when both sides have the same id.
 */
export async function syncWishlistOnLogin(userId: string): Promise<void> {
  const local = useWishlistStore.getState().items;
  const remote = await getWishlist(userId);
  const remoteIds = remote?.productIds ?? [];
  const remoteItems = remote?.items ?? [];

  const merged = new Map<string, WishlistEntry>();

  for (const id of remoteIds) {
    const structured = remoteItems.find((item) => item.productId === id);
    merged.set(id, {
      productId: id,
      slug: id,
      name: id,
      icon: "cpu",
      tone: "bg-soft",
      price: 0,
      stock: 0,
      rating: 0,
      reviews: 0,
      addedAt:
        structured?.addedAt != null
          ? String(structured.addedAt)
          : new Date().toISOString(),
    });
  }

  for (const entry of local) {
    merged.set(entry.productId, entry);
  }

  const items = Array.from(merged.values());
  useWishlistStore.getState().replaceItems(items);

  await setWishlist(userId, {
    userId,
    productIds: items.map((item) => item.productId),
    items: items.map((item) => ({
      productId: item.productId,
      addedAt: item.addedAt as WishlistEntry["addedAt"],
    })),
  });
}

export async function pushWishlistToFirestore(userId: string): Promise<void> {
  const items = useWishlistStore.getState().items;
  await setWishlist(userId, {
    userId,
    productIds: items.map((item) => item.productId),
    items: items.map((item) => ({
      productId: item.productId,
      addedAt: item.addedAt as WishlistEntry["addedAt"],
    })),
  });
}
