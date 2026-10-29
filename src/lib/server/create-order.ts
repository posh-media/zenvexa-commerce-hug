import { COLLECTIONS } from "@/constants/collections";
import {
  DELIVERY_OPTIONS,
  deliveryFeeFor,
  generateOrderNumber,
  orderGrandTotal,
  type DeliveryOptionId,
} from "@/lib/cart";
import { validateCouponDocument } from "@/lib/coupons";
import { clientTimelineEntry } from "@/lib/order-timeline";
import { getAdminDb } from "@/lib/server/firebase-admin";
import {
  belongsToStore,
  deploymentStoreId,
  requireStoreName,
} from "@/lib/store";
import type {
  PlaceOrderInput,
  PlaceOrderResult,
} from "@/services/orders.service";
import { getAppSettings } from "@/services/settings.service";
import type { Coupon } from "@/types/coupon";
import type { Order, OrderDocument, OrderItem } from "@/types/order";
import type { ProductDocument } from "@/types/product";
import type { Address } from "@/types/user";
import { stripUndefined } from "@/utils/firestore";
import { FieldValue } from "firebase-admin/firestore";
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
  if (
    !input.customer?.phone?.trim() ||
    input.customer.phone.trim().length < 7
  ) {
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
    if (
      !Number.isSafeInteger(Number(line.quantity)) ||
      Number(line.quantity) <= 0 ||
      Number(line.quantity) > 10000
    ) {
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

export async function createPendingOrderServer(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const validationError = validatePlaceOrderInput(input);
  if (validationError) {
    return { ok: false, reason: validationError };
  }

  const db = getAdminDb();
  const settings = await getAppSettings();
  const storeName = requireStoreName(settings);
  const storeId = deploymentStoreId();
  const orderNumber = generateOrderNumber(storeName);
  const orderRef = db.collection("orders").doc();
  const shippingAddress = normalizeShippingAddress(input.shippingAddress);

  try {
    const order = await db.runTransaction(async (transaction) => {
      const products: OrderItem[] = [];
      const requestedQuantities = new Map<string, number>();

      for (const line of input.lines) {
        const productRef = db
          .collection(COLLECTIONS.products)
          .doc(line.productId);
        const snapshot = await transaction.get(productRef);
        if (!snapshot.exists) {
          throw new Error(
            `"${line.name}" is no longer available. Remove it from your cart.`,
          );
        }

        const data = snapshot.data() as ProductDocument;
        if (data.active === false) {
          throw new Error(`"${line.name}" is unavailable.`);
        }

        const stock = Number(data.stock ?? 0);
        const requested =
          (requestedQuantities.get(line.productId) || 0) +
          Number(line.quantity);
        requestedQuantities.set(line.productId, requested);
        if (stock < requested) {
          throw new Error(
            stock <= 0
              ? `"${line.name}" is out of stock.`
              : `Only ${stock} of "${line.name}" left in stock.`,
          );
        }

        const unitPrice = Number(data.price);
        if (!Number.isFinite(unitPrice) || unitPrice < 0)
          throw new Error("Product price is invalid.");
        products.push({
          productId: line.productId,
          name: data.productName ?? line.name ?? "",
          slug: data.slug ?? line.slug ?? "",
          image: data.thumbnail ?? line.thumbnail ?? "",
          variation: line.variation ?? "",
          unitPrice,
          quantity: Number(line.quantity),
          lineTotal: unitPrice * line.quantity,
        });
      }

      const subtotal = products.reduce(
        (sum, item) => sum + (item.lineTotal || 0),
        0,
      );
      let discount = 0;
      if (input.couponCode?.trim()) {
        const couponQuery = db
          .collection("coupons")
          .where("code", "==", input.couponCode.trim().toUpperCase());
        const couponSnapshot = await transaction.get(couponQuery);
        const couponDoc = couponSnapshot.docs.find((doc) =>
          belongsToStore(doc.data()),
        );
        if (!couponDoc) throw new Error("Coupon is unavailable.");
        const couponResult = validateCouponDocument(
          { id: couponDoc.id, ...couponDoc.data() } as Coupon,
          subtotal,
        );
        if (!couponResult.ok) throw new Error(couponResult.reason);
        discount = couponResult.discount;
      }
      const deliveryId = input.deliveryOptionId || "express";
      if (!DELIVERY_OPTIONS.some((d) => d.id === deliveryId))
        throw new Error("Unknown delivery option.");
      const custom = settings?.deliveryOptions?.find(
        (d) => d.id === deliveryId,
      );
      if (custom?.active === false)
        throw new Error("Delivery option is unavailable.");
      const shipping =
        custom?.fee ?? deliveryFeeFor(deliveryId as DeliveryOptionId, subtotal);
      const totals = orderGrandTotal({
        subtotal,
        discount,
        shipping,
        taxRate: settings?.taxRate ?? 0.075,
      });
      if (
        !Number.isFinite(shipping) ||
        shipping < 0 ||
        !Number.isFinite(totals.total) ||
        totals.total < 1
      )
        throw new Error("Order total is invalid.");
      if (
        !Number.isFinite(Number(input.total)) ||
        Math.abs(Number(input.total) - totals.total) > 0.01
      )
        throw new Error(
          "Prices or store charges changed. Refresh checkout before paying.",
        );
      input = {
        ...input,
        subtotal,
        discount,
        deliveryFee: shipping,
        tax: totals.tax,
        total: totals.total,
      };
      const timeline = [
        clientTimelineEntry("order_created"),
        clientTimelineEntry("payment_pending"),
      ];

      const orderData: OrderDocument = {
        storeId,
        storeName,
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
        createdAt: FieldValue.serverTimestamp() as OrderDocument["createdAt"],
        updatedAt: FieldValue.serverTimestamp() as OrderDocument["updatedAt"],
      };

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
