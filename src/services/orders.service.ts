import { orderDoc, ordersCollection } from "@/firebase/collections";
import type { CartLine } from "@/lib/cart";
import { belongsToStore } from "@/lib/store";
import { storeDocuments } from "@/lib/store-queries";
import type { Order } from "@/types/order";
import type { Address } from "@/types/user";
import {
  getDoc,
  getDocs,
  limit as limitTo,
  query,
  where,
} from "firebase/firestore";

export async function getOrderById(id: string): Promise<Order | undefined> {
  const snapshot = await getDoc(orderDoc(id));
  return snapshot.exists() && belongsToStore(snapshot.data())
    ? snapshot.data()
    : undefined;
}

export async function listOrdersByUser(userId: string): Promise<Order[]> {
  const documents = await storeDocuments(ordersCollection(), [
    where("userId", "==", userId),
  ]);
  return documents.map((document) => document.data());
}

export async function getOrderByNumber(
  orderNumber: string,
): Promise<Order | undefined> {
  const normalized = orderNumber.trim().toUpperCase();
  if (!normalized) return undefined;

  const snapshot = await getDocs(
    query(
      ordersCollection(),
      where("orderNumber", "==", normalized),
      limitTo(1),
    ),
  );
  if (snapshot.docs[0] && belongsToStore(snapshot.docs[0].data()))
    return snapshot.docs[0].data();

  return getOrderById(orderNumber.trim());
}

/**
 * Watch an order until paymentStatus becomes paid (or timeout).
 * Used on the Paystack callback page so success navigates without refresh.
 */
export function watchOrderUntilPaid(
  orderIdOrNumber: string,
  options?: {
    timeoutMs?: number;
    onUpdate?: (order: Order) => void;
  },
): Promise<Order | null> {
  const timeoutMs = options?.timeoutMs ?? 120_000;

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (order: Order | null) => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      resolve(order);
    };

    const consider = (order: Order | undefined) => {
      if (!order || !belongsToStore(order)) return;
      options?.onUpdate?.(order);
      // COD commitment-fee orders stay paymentStatus "pending" by design —
      // resolve when the fee is verified instead.
      if (
        order.paymentStatus === "paid" ||
        (String(order.paymentMethod ?? "") === "cash-on-delivery" &&
          order.commitmentFeeStatus === "paid")
      ) {
        finish(order);
      }
    };

    void (async () => {
      // Resolve document id (order number → id) then attach snapshot listener.
      let order = await getOrderByNumber(orderIdOrNumber);
      if (!order) {
        order = await getOrderById(orderIdOrNumber);
      }
      if (!order) {
        finish(null);
        return;
      }
      consider(order);

      const { onSnapshot } = await import("firebase/firestore");
      unsubscribe = onSnapshot(
        orderDoc(order.id),
        (snap) => {
          if (!snap.exists()) return;
          consider(snap.data());
        },
        () => {
          /* fall through to polling */
        },
      );

      pollTimer = setInterval(() => {
        void getOrderById(order!.id).then((latest) => consider(latest));
      }, 3000);

      timeoutTimer = setTimeout(() => finish(null), timeoutMs);
    })();
  });
}

export type PlaceOrderInput = {
  userId: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  lines: CartLine[];
  shippingAddress: Address;
  deliveryFee: number;
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
  paymentMethod: string;
  notes?: string;
  deliveryOptionId?: string;
  couponCode?: string;
};

export type PlaceOrderResult =
  { ok: true; order: Order } | { ok: false; reason: string };

export async function createPendingOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  try {
    const { authenticatedFetch } = await import("@/lib/client-api");
    const response = await authenticatedFetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return (await response.json()) as PlaceOrderResult;
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error ? error.message : "Could not create order.",
    };
  }
}

/**
 * @deprecated Prefer `createPendingOrder` + payment APIs.
 * Kept as an alias so existing call sites keep compiling during migration.
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  return createPendingOrder(input);
}
