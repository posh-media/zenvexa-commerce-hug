import type { IconKey } from "@/lib/data";

/** Guest-persisted cart line with display snapshot. Firestore sync stores ids only. */
export type CartLine = {
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
  quantity: number;
  variation?: string;
  subcategory?: string;
};

export const CART_STORAGE_KEY = "shopbeta.cart.v1";
export const WISHLIST_STORAGE_KEY = "shopbeta.wishlist.v1";
export const GUEST_ID_KEY = "shopbeta.guest-id.v1";
export const LAST_ORDER_KEY = "shopbeta.last-order.v1";

/** Free delivery threshold in NGN. */
export const FREE_DELIVERY_THRESHOLD = 50_000;

export const DELIVERY_OPTIONS = [
  {
    id: "express",
    label: "Express — free next-day when eligible",
    fee: 0,
    estimatedDays: "1 business day",
  },
  {
    id: "standard",
    label: "Standard — free (2–4 working days)",
    fee: 0,
    estimatedDays: "2–4 working days",
  },
  {
    id: "pickup",
    label: "Store pickup — free (ready in <6 hours)",
    fee: 0,
    estimatedDays: "Same day - Pickup details will be sent to provided email address",
  },
] as const;

export type DeliveryOptionId = (typeof DELIVERY_OPTIONS)[number]["id"];

export function cartLineKey(line: Pick<CartLine, "productId" | "variation">) {
  return `${line.productId}::${line.variation ?? ""}`;
}

export function cartItemCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
}

export function deliveryFeeFor(
  optionId: DeliveryOptionId,
  subtotal: number,
): number {
  const option = DELIVERY_OPTIONS.find((entry) => entry.id === optionId);
  if (!option) return 0;
  if (option.id === "express" && subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  if (option.id === "express" && subtotal < FREE_DELIVERY_THRESHOLD) {
    return 2_500;
  }
  return option.fee;
}

export function estimateTaxes(taxable: number, taxRate = 0.075) {
  return Math.max(0, Math.round(taxable * taxRate));
}

export function orderGrandTotal({
  subtotal,
  discount = 0,
  shipping = 0,
  taxRate = 0.075,
}: {
  subtotal: number;
  discount?: number;
  shipping?: number;
  taxRate?: number;
}) {
  const taxable = Math.max(0, subtotal - discount);
  const tax = estimateTaxes(taxable, taxRate);
  return {
    tax,
    total: taxable + shipping + tax,
  };
}

export function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function getGuestId(): string {
  if (typeof window === "undefined") return "guest";
  const existing = window.localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `g-${Date.now()}`;
  window.localStorage.setItem(GUEST_ID_KEY, id);
  return id;
}

export function generateOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `SB-${stamp}${rand}`;
}

export function estimatedDeliveryLabel(optionId: DeliveryOptionId = "express") {
  const days = optionId === "express" ? 1 : optionId === "standard" ? 3 : 1;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
