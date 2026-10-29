"use client";

import { isFirebaseConfigured } from "@/firebase/config";
import { syncWishlistOnLogin } from "@/lib/wishlist-sync";
import { ensureUserProfile, subscribeToAuth } from "@/services/auth.service";
import { listNotificationsByUser } from "@/services/notifications.service";
import { useCartStore } from "@/stores/cart.store";
import { useNotificationsStore } from "@/stores/notifications.store";
import { useSearchStore } from "@/stores/search.store";
import { useUserStore } from "@/stores/user.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useEffect, type ReactNode } from "react";

import { WishlistSyncBridge } from "@/components/commerce/wishlist-sync-bridge";
import { ClientErrorReporter } from "@/components/system/client-error-reporter";
import { ToastViewport } from "@/components/ui/toast-viewport";

/**
 * Hydrates guest cart/wishlist and keeps Auth + account stores in sync.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const hydrateCart = useCartStore((state) => state.hydrate);
  const hydrateWishlist = useWishlistStore((state) => state.hydrate);
  const hydrateSearch = useSearchStore((state) => state.hydrate);
  const setAuthUser = useUserStore((state) => state.setAuthUser);
  const setProfile = useUserStore((state) => state.setProfile);
  const setStatus = useUserStore((state) => state.setStatus);
  const resetUser = useUserStore((state) => state.reset);
  const setNotifications = useNotificationsStore((state) => state.setItems);
  const setUnreadCount = useNotificationsStore((state) => state.setUnreadCount);
  const resetNotifications = useNotificationsStore((state) => state.reset);
  const mergeRemoteSearch = useSearchStore((state) => state.mergeRemote);

  useEffect(() => {
    hydrateCart();
    hydrateWishlist();
    hydrateSearch();
  }, [hydrateCart, hydrateWishlist, hydrateSearch]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStatus("anonymous");
      return;
    }
    const unsubscribe = subscribeToAuth((user) => {
      void (async () => {
        if (!user || user.isAnonymous) {
          setAuthUser(null);
          setProfile(null);
          setStatus("anonymous");
          resetNotifications();
          return;
        }

        setAuthUser(user);
        setStatus("loading");
        try {
          const profile = await ensureUserProfile(user);
          setProfile(profile);
          setStatus("authenticated");

          await syncWishlistOnLogin(user.uid).catch(() => undefined);

          if (profile.searchHistory?.length) {
            mergeRemoteSearch(profile.searchHistory);
          }

          const notifications = await listNotificationsByUser(user.uid).catch(
            () => [],
          );
          setNotifications(notifications);
          setUnreadCount(notifications.filter((item) => !item.read).length);
        } catch {
          setProfile(null);
          setStatus("authenticated");
          const { reportAuthError } = await import("@/lib/monitoring");
          reportAuthError("Failed to load user profile after sign-in");
        }
      })();
    });

    return () => {
      unsubscribe();
      resetUser();
    };
  }, [
    mergeRemoteSearch,
    resetNotifications,
    resetUser,
    setAuthUser,
    setNotifications,
    setProfile,
    setStatus,
    setUnreadCount,
  ]);

  return (
    <>
      <ClientErrorReporter />
      <WishlistSyncBridge />
      {children}
      <ToastViewport />
    </>
  );
}
