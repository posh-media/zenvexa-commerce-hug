import type { OrderTimelineEvent } from "@/constants/app";
import type { OrderTimelineEntry } from "@/types/payment";

const LABELS: Record<string, { label: string; description?: string }> = {
  order_created: {
    label: "Order created",
    description: "Your order was placed successfully.",
  },
  payment_pending: {
    label: "Payment pending",
    description: "Waiting for payment confirmation.",
  },
  payment_processing: {
    label: "Payment processing",
    description: "Your payment is being confirmed.",
  },
  payment_successful: {
    label: "Payment successful",
    description: "Payment has been confirmed.",
  },
  payment_failed: {
    label: "Payment failed",
    description: "The payment attempt was unsuccessful.",
  },
  payment_cancelled: {
    label: "Payment cancelled",
    description: "Payment was cancelled before completion.",
  },
  payment_expired: {
    label: "Payment expired",
    description: "The payment session expired.",
  },
  order_confirmed: {
    label: "Order confirmed",
    description: "We are preparing your order.",
  },
  preparing_shipment: {
    label: "Preparing shipment",
    description: "Items are being packed.",
  },
  shipped: {
    label: "Shipped",
    description: "Your order is on the way.",
  },
  delivered: {
    label: "Delivered",
    description: "Order delivered successfully.",
  },
  cancelled: {
    label: "Cancelled",
    description: "This order was cancelled.",
  },
  refunded: {
    label: "Refunded",
    description: "Payment was refunded.",
  },
};

export function timelineEntry(
  event: OrderTimelineEvent | string,
  at: Date = new Date(),
  description?: string,
): OrderTimelineEntry {
  const meta = LABELS[event] ?? { label: event };
  return {
    event,
    label: meta.label,
    description: description ?? meta.description ?? null,
    at,
  };
}

export function clientTimelineEntry(
  event: OrderTimelineEvent | string,
  description?: string,
): OrderTimelineEntry {
  return timelineEntry(event, new Date(), description);
}

export function appendTimeline(
  existing: OrderTimelineEntry[] | undefined,
  event: OrderTimelineEvent | string,
  description?: string,
) {
  return [...(existing ?? []), timelineEntry(event, new Date(), description)];
}
