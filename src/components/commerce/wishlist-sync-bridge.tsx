"use client";

import { useEffect, useRef } from "react";
import { pushWishlistToFirestore } from "@/lib/wishlist-sync";
import { useUserStore } from "@/stores/user.store";
import { useWishlistStore } from "@/stores/wishlist.store";

/** Debounced Firestore push whenever an authenticated wishlist changes. */
export function WishlistSyncBridge() {
  const status = useUserStore((state) => state.status);
  const uid = useUserStore((state) => state.authUser?.uid);
  const items = useWishlistStore((state) => state.items);
  const hydrated = useWishlistStore((state) => state.hydrated);
  const ready = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !uid || !hydrated) return;
    if (!ready.current) {
      ready.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      void pushWishlistToFirestore(uid).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [hydrated, items, status, uid]);

  useEffect(() => {
    if (status !== "authenticated") ready.current = false;
  }, [status]);

  return null;
}
