import {
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { COLLECTIONS } from "@/constants/collections";
import { getDb } from "@/firebase/firestore";
import { orderDoc, ordersCollection } from "@/firebase/collections";
import type { CartLine } from "@/lib/cart";
import { generateOrderNumber } from "@/lib/cart";
import { clientTimelineEntry } from "@/lib/order-timeline";
import type { Order, OrderDocument, OrderItem } from "@/types/order";
import type { Address } from "@/types/user";
import type { ProductDocument } from "@/types/product";
import { findUndefinedPaths, stripUndefined } from "@/utils/firestore";

export async function getOrderById(id: string): Promise<Order | undefined> {
  const snapshot = await getDoc(orderDoc(id));
  return snapshot.exists() ? snapshot.data() : undefined;
}

export async function listOrdersByUser(userId: string): Promise<Order[]> {
  const snapshot = await getDocs(
    query(ordersCollection(), where("userId", "==", userId)),
  );
  return snapshot.docs.map((document) => document.data());
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
  if (snapshot.docs[0]) return snapshot.docs[0].data();

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
      if (!order) return;
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
  | { ok: true; order: Order }
  | { ok: false; reason: string };

function validatePlaceOrderInput(input: PlaceOrderInput): string | null {
  if (!input.userId?.trim()) {
    return "You must be signed in or continue as a guest.";
  }
  if (!input.lines?.length) {
    return "Your cart is empty.";
  }
  if (!input.customer?.name?.trim()) {
    return "Customer name is required.";
  }
  if (!input.customer?.email?.trim() || !input.customer.email.includes("@")) {
    return "A valid customer email is required.";
  }
  if (!input.customer?.phone?.trim() || input.customer.phone.trim().length < 7) {
    return "A valid customer phone number is required.";
  }
  if (!input.paymentMethod?.trim()) {
    return "Select a payment method.";
  }

  const address = input.shippingAddress;
  if (
    !address?.fullName?.trim() ||
    !address?.phone?.trim() ||
    !address?.line1?.trim() ||
    !address?.city?.trim() ||
    !address?.country?.trim()
  ) {
    return "Complete your shipping address.";
  }

  for (const line of input.lines) {
    if (!line.productId?.trim()) {
      return "Your cart contains an invalid product.";
    }
    if (!(Number(line.quantity) > 0)) {
      return `"${line.name || "Item"}" has an invalid quantity.`;
    }
  }

  return null;
}

function normalizeShippingAddress(address: Address): Address {
  return {
    fullName: address.fullName.trim(),
    phone: address.phone.trim(),
    line1: address.line1.trim(),
    line2: address.line2?.trim() ?? "",
    city: address.city.trim(),
    state: address.state?.trim() ?? "",
    postalCode: address.postalCode?.trim() ?? "",
    country: address.country.trim(),
    isDefault: address.isDefault ?? true,
    ...(address.id ? { id: address.id } : {}),
    ...(address.label ? { label: address.label } : {}),
  };
}

/**
 * Create a pending order without reducing stock.
 * Stock is reserved after Paystack verification or COD confirmation (server).
 */
export async function createPendingOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const validationError = validatePlaceOrderInput(input);
  if (validationError) {
    return { ok: false, reason: validationError };
  }

  const db = getDb();
  const orderNumber = generateOrderNumber();
  const orderRef = doc(ordersCollection());
  const shippingAddress = normalizeShippingAddress(input.shippingAddress);

  try {
    const order = await runTransaction(db, async (transaction) => {
      const products: OrderItem[] = [];

      for (const line of input.lines) {
        const productRef = doc(db, COLLECTIONS.products, line.productId);
        const snapshot = await transaction.get(productRef);
        if (!snapshot.exists()) {
          throw new Error(
            `"${line.name}" is no longer available. Remove it from your cart.`,
          );
        }

        const data = snapshot.data() as ProductDocument;
        if (data.active === false) {
          throw new Error(`"${line.name}" is unavailable.`);
        }

        const stock = Number(data.stock ?? 0);
        if (stock < line.quantity) {
          throw new Error(
            stock <= 0
              ? `"${line.name}" is out of stock.`
              : `Only ${stock} of "${line.name}" left in stock.`,
          );
        }

        const unitPrice = Number(data.price ?? line.price);
        products.push({
          productId: line.productId,
          name: data.productName ?? line.name ?? "",
          slug: data.slug ?? line.slug ?? "",
          image: data.thumbnail ?? line.thumbnail ?? "",
          variation: line.variation ?? "",
          unitPrice,
          quantity: line.quantity,
          lineTotal: unitPrice * line.quantity,
        });
      }

      const timeline = [
        clientTimelineEntry("order_created"),
        clientTimelineEntry("payment_pending"),
      ];

      const orderData: OrderDocument = {
        orderNumber,
        reference: orderNumber,
        userId: input.userId,
        customer: {
          userId: input.userId,
          name: input.customer.name.trim(),
          email: input.customer.email.trim(),
          phone: input.customer.phone.trim(),
        },
        products,
        items: products,
        subtotal: Number(input.subtotal) || 0,
        deliveryFee: Number(input.deliveryFee) || 0,
        shipping: Number(input.deliveryFee) || 0,
        discount: Number(input.discount) || 0,
        tax: Number(input.tax) || 0,
        total: Number(input.total) || 0,
        totals: {
          subtotal: Number(input.subtotal) || 0,
          deliveryFee: Number(input.deliveryFee) || 0,
          shipping: Number(input.deliveryFee) || 0,
          discount: Number(input.discount) || 0,
          tax: Number(input.tax) || 0,
          total: Number(input.total) || 0,
        },
        paymentMethod: input.paymentMethod,
        paymentStatus: "pending",
        orderStatus: "pending",
        status: "pending",
        ...(input.paymentMethod === "cash-on-delivery"
          ? {
              codCommitmentFee: Math.ceil((Number(input.total) || 0) * 0.25),
              codAmountPaid: 0,
              codBalance: Number(input.total) || 0,
              commitmentFeeStatus: "pending" as const,
            }
          : {}),
        shippingAddress,
        notes: input.notes?.trim() ?? "",
        deliveryOptionId: input.deliveryOptionId ?? "",
        couponCode: input.couponCode?.trim() ?? "",
        timeline,
        inventoryReserved: false,
        createdAt: serverTimestamp() as OrderDocument["createdAt"],
        updatedAt: serverTimestamp() as OrderDocument["updatedAt"],
      };

      const undefinedPaths = findUndefinedPaths(orderData);
      if (undefinedPaths.length > 0) {
        console.warn(
          "[createPendingOrder] undefined fields before sanitize:",
          undefinedPaths,
        );
      }
      console.log("[createPendingOrder] orderData before write", {
        ...orderData,
        createdAt: "[serverTimestamp]",
        updatedAt: "[serverTimestamp]",
        undefinedPaths,
      });

      const sanitized = stripUndefined(orderData);
      transaction.set(orderRef, sanitized);

      return {
        id: orderRef.id,
        ...sanitized,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies Order;
    });

    return { ok: true, order };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not place your order. Please try again.";
    console.error("[createPendingOrder] failed", message, error);
    return { ok: false, reason: message };
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
