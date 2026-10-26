import { create } from "zustand";
import type { WishlistEntry } from "@/lib/wishlist";
import {
  WISHLIST_STORAGE_KEY,
  readJsonStorage,
  writeJsonStorage,
} from "@/lib/cart";

type WishlistState = {
  items: WishlistEntry[];
  hydrated: boolean;
};

type WishlistActions = {
  hydrate: () => void;
  addItem: (entry: WishlistEntry) => void;
  removeItem: (productId: string) => void;
  toggleItem: (entry: WishlistEntry) => boolean;
  has: (productId: string) => boolean;
  clear: () => void;
  replaceItems: (items: WishlistEntry[]) => void;
  reset: () => void;
};

function persist(items: WishlistEntry[]) {
  writeJsonStorage(WISHLIST_STORAGE_KEY, items);
}

const initialState: WishlistState = {
  items: [],
  hydrated: false,
};

export const useWishlistStore = create<WishlistState & WishlistActions>()(
  (set, get) => ({
    ...initialState,

    hydrate: () => {
      if (get().hydrated) return;
      const items = readJsonStorage<WishlistEntry[]>(WISHLIST_STORAGE_KEY, []);
      set({
        items: Array.isArray(items) ? items : [],
        hydrated: true,
      });
    },

    addItem: (entry) => {
      if (get().items.some((item) => item.productId === entry.productId)) {
        return;
      }
      const items = [
        { ...entry, addedAt: entry.addedAt ?? new Date().toISOString() },
        ...get().items,
      ];
      persist(items);
      set({ items });
    },

    removeItem: (productId) => {
      const items = get().items.filter((item) => item.productId !== productId);
      persist(items);
      set({ items });
    },

    toggleItem: (entry) => {
      if (get().items.some((item) => item.productId === entry.productId)) {
        get().removeItem(entry.productId);
        return false;
      }
      get().addItem(entry);
      return true;
    },

    has: (productId) =>
      get().items.some((item) => item.productId === productId),

    clear: () => {
      persist([]);
      set({ items: [] });
    },

    replaceItems: (items) => {
      persist(items);
      set({ items, hydrated: true });
    },

    reset: () => {
      persist([]);
      set(initialState);
    },
  }),
);
