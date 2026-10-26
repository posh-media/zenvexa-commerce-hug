import { create } from "zustand";
import type { CartLine } from "@/lib/cart";
import {
  CART_STORAGE_KEY,
  cartLineKey,
  readJsonStorage,
  writeJsonStorage,
} from "@/lib/cart";

type CartState = {
  items: CartLine[];
  hydrated: boolean;
};

type CartActions = {
  hydrate: () => void;
  addItem: (line: Omit<CartLine, "quantity"> & { quantity?: number }) => {
    ok: boolean;
    reason?: string;
  };
  removeItem: (productId: string, variation?: string) => void;
  setQuantity: (
    productId: string,
    quantity: number,
    variation?: string,
  ) => { ok: boolean; reason?: string };
  increment: (productId: string, variation?: string) => {
    ok: boolean;
    reason?: string;
  };
  decrement: (productId: string, variation?: string) => void;
  clear: () => void;
  reset: () => void;
};

function persist(items: CartLine[]) {
  writeJsonStorage(CART_STORAGE_KEY, items);
}

const initialState: CartState = {
  items: [],
  hydrated: false,
};

export const useCartStore = create<CartState & CartActions>()((set, get) => ({
  ...initialState,

  hydrate: () => {
    if (get().hydrated) return;
    const items = readJsonStorage<CartLine[]>(CART_STORAGE_KEY, []);
    set({
      items: Array.isArray(items) ? items : [],
      hydrated: true,
    });
  },

  addItem: (input) => {
    const quantity = Math.max(1, input.quantity ?? 1);
    if (input.stock <= 0) {
      return { ok: false, reason: "This product is out of stock." };
    }

    const items = [...get().items];
    const key = cartLineKey(input);
    const index = items.findIndex((line) => cartLineKey(line) === key);

    if (index >= 0) {
      const nextQty = items[index].quantity + quantity;
      if (nextQty > input.stock) {
        return {
          ok: false,
          reason: `Only ${input.stock} left in stock.`,
        };
      }
      items[index] = {
        ...items[index],
        ...input,
        quantity: nextQty,
      };
    } else {
      if (quantity > input.stock) {
        return {
          ok: false,
          reason: `Only ${input.stock} left in stock.`,
        };
      }
      items.push({ ...input, quantity });
    }

    persist(items);
    set({ items });
    return { ok: true };
  },

  removeItem: (productId, variation) => {
    const items = get().items.filter(
      (line) =>
        !(line.productId === productId && (line.variation ?? "") === (variation ?? "")),
    );
    persist(items);
    set({ items });
  },

  setQuantity: (productId, quantity, variation) => {
    const items = [...get().items];
    const index = items.findIndex(
      (line) =>
        line.productId === productId &&
        (line.variation ?? "") === (variation ?? ""),
    );
    if (index < 0) return { ok: false, reason: "Item not in cart." };

    if (quantity <= 0) {
      items.splice(index, 1);
      persist(items);
      set({ items });
      return { ok: true };
    }

    if (quantity > items[index].stock) {
      return {
        ok: false,
        reason: `Only ${items[index].stock} left in stock.`,
      };
    }

    items[index] = { ...items[index], quantity };
    persist(items);
    set({ items });
    return { ok: true };
  },

  increment: (productId, variation) => {
    const line = get().items.find(
      (item) =>
        item.productId === productId &&
        (item.variation ?? "") === (variation ?? ""),
    );
    if (!line) return { ok: false, reason: "Item not in cart." };
    return get().setQuantity(productId, line.quantity + 1, variation);
  },

  decrement: (productId, variation) => {
    const line = get().items.find(
      (item) =>
        item.productId === productId &&
        (item.variation ?? "") === (variation ?? ""),
    );
    if (!line) return;
    get().setQuantity(productId, line.quantity - 1, variation);
  },

  clear: () => {
    persist([]);
    set({ items: [] });
  },

  reset: () => {
    persist([]);
    set(initialState);
  },
}));
