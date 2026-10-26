import { getDoc, setDoc } from "firebase/firestore";
import { wishlistDoc } from "@/firebase/collections";
import type { Wishlist, WishlistDocument } from "@/types/commerce";
import { stripUndefined } from "@/utils/firestore";

export async function getWishlist(
  userId: string,
): Promise<Wishlist | undefined> {
  const snapshot = await getDoc(wishlistDoc(userId));
  return snapshot.exists() ? snapshot.data() : undefined;
}

/** Create or overwrite the wishlist document for a user (doc id = userId). */
export async function setWishlist(
  userId: string,
  data: Partial<WishlistDocument>,
): Promise<void> {
  await setDoc(
    wishlistDoc(userId),
    stripUndefined({ ...data, userId, id: userId }) as Wishlist,
    { merge: true },
  );
}
