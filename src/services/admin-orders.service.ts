import { orderDoc, ordersCollection } from "@/firebase/collections";
import { authenticatedFetch } from "@/lib/client-api";
import { appendTimeline } from "@/lib/order-timeline";
import { belongsToStore } from "@/lib/store";
import { storeDocuments } from "@/lib/store-queries";
import { writeAuditLog } from "@/services/audit.service";
import type { Order, OrderStatus, PaymentStatus } from "@/types/order";
import { stripUndefined } from "@/utils/firestore";
import {
  deleteDoc,
  getDoc,
  orderBy,
  serverTimestamp,
  updateDoc,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

type Actor = { id: string; email?: string };

export async function listOrdersAdmin(): Promise<Order[]> {
  const documents = await storeDocuments(ordersCollection());
  return documents
    .map((d) => d.data())
    .sort((a, b) => {
      const aTime =
        a.createdAt instanceof Date
          ? a.createdAt.getTime()
          : a.createdAt &&
              typeof a.createdAt === "object" &&
              "toDate" in a.createdAt
            ? (a.createdAt as { toDate: () => Date }).toDate().getTime()
            : typeof a.createdAt === "string" || typeof a.createdAt === "number"
              ? new Date(a.createdAt).getTime()
              : 0;
      const bTime =
        b.createdAt instanceof Date
          ? b.createdAt.getTime()
          : b.createdAt &&
              typeof b.createdAt === "object" &&
              "toDate" in b.createdAt
            ? (b.createdAt as { toDate: () => Date }).toDate().getTime()
            : typeof b.createdAt === "string" || typeof b.createdAt === "number"
              ? new Date(b.createdAt).getTime()
              : 0;
      return bTime - aTime;
    });
}

export type AdminOrdersPage = {
  orders: Order[];
  lastDoc: QueryDocumentSnapshot<Order> | null;
  total: number;
};

/**
 * Cursor-paginated admin order listing, newest first. Status filters are
 * pushed into the Firestore query; `total` is the filtered count for the
 * active filters.
 */
export async function listOrdersAdminPage(options?: {
  paymentStatus?: string;
  orderStatus?: string;
  pageSize?: number;
  after?: QueryDocumentSnapshot<Order> | null;
}): Promise<AdminOrdersPage> {
  const pageSize = options?.pageSize ?? 25;
  const base: QueryConstraint[] = [];

  if (options?.paymentStatus && options.paymentStatus !== "all") {
    base.push(where("paymentStatus", "==", options.paymentStatus));
  }
  if (options?.orderStatus && options.orderStatus !== "all") {
    base.push(where("orderStatus", "==", options.orderStatus));
  }
  base.push(orderBy("createdAt", "desc"));

  const documents = await storeDocuments(ordersCollection(), base);
  const afterIndex = options?.after
    ? documents.findIndex((doc) => doc.id === options.after!.id)
    : -1;
  const page = documents.slice(afterIndex + 1, afterIndex + 1 + pageSize);
  return {
    orders: page.map((doc) => doc.data()),
    lastDoc: page[page.length - 1] ?? null,
    total: documents.length,
  };
}

export async function getOrderAdmin(id: string) {
  const snapshot = await getDoc(orderDoc(id));
  return snapshot.exists() && belongsToStore(snapshot.data())
    ? snapshot.data()
    : undefined;
}

function timelineEventForStatus(orderStatus: OrderStatus) {
  if (orderStatus === "shipped") return "shipped";
  if (orderStatus === "delivered") return "delivered";
  if (orderStatus === "cancelled") return "cancelled";
  if (orderStatus === "processing") return "preparing_shipment";
  if (orderStatus === "paid") return "payment_successful";
  if (orderStatus === "refunded") return "refunded";
  return "order_confirmed";
}

export async function updateOrderStatusAdmin(
  id: string,
  orderStatus: OrderStatus,
  actor: Actor,
) {
  const existing = await getOrderAdmin(id);
  if (!existing) throw new Error("Order not found.");
  const timeline = appendTimeline(
    existing.timeline,
    timelineEventForStatus(orderStatus),
  );
  await updateDoc(
    orderDoc(id),
    stripUndefined({
      orderStatus,
      status: orderStatus,
      timeline,
      updatedAt: serverTimestamp(),
    }),
  );
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "order.status_update",
    resourceType: "order",
    resourceId: id,
    previousValue: existing.orderStatus ?? existing.status ?? null,
    newValue: orderStatus,
  });
}

export async function updateOrderPaymentStatusAdmin(
  id: string,
  paymentStatus: PaymentStatus,
  actor: Actor,
) {
  const existing = await getOrderAdmin(id);
  await updateDoc(
    orderDoc(id),
    stripUndefined({
      paymentStatus,
      updatedAt: serverTimestamp(),
    }),
  );
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "order.payment_status_update",
    resourceType: "order",
    resourceId: id,
    previousValue: existing?.paymentStatus ?? null,
    newValue: paymentStatus,
  });
}

export async function setOrderTrackingAdmin(
  id: string,
  trackingNumber: string,
  actor: Actor,
) {
  await updateDoc(
    orderDoc(id),
    stripUndefined({
      trackingNumber,
      updatedAt: serverTimestamp(),
    }),
  );
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "order.tracking_update",
    resourceType: "order",
    resourceId: id,
    newValue: { trackingNumber },
  });
}

export async function deleteOrderAdmin(id: string, actor: Actor) {
  const existing = await getOrderAdmin(id);
  if (!existing) throw new Error("Order not found.");

  await deleteDoc(orderDoc(id));

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "order.deleted",
    resourceType: "order",
    resourceId: id,
    previousValue: {
      orderNumber: existing.orderNumber,
      total: existing.total,
      paymentStatus: existing.paymentStatus,
    },
  });
}

export async function sendOrderEmailAdmin(
  id: string,
  actor: Actor,
  options?: { recipientOverride?: string },
) {
  const existing = await getOrderAdmin(id);
  if (!existing) throw new Error("Order not found.");

  if (existing.paymentStatus !== "paid") {
    throw new Error("Cannot send email for unpaid order.");
  }

  if (existing.makeNotifyStatus === "sent") {
    throw new Error("Order email has already been sent.");
  }

  const response = await authenticatedFetch("/api/transactional-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      emailType: "order_confirmation",
      orderId: id,
      order: { ...existing, id },
      recipientOverride: options?.recipientOverride,
    }),
  });

  const result = (await response.json().catch(() => null)) as {
    ok?: boolean;
    message?: string;
  } | null;

  if (!response.ok || !result?.ok) {
    await updateDoc(orderDoc(id), {
      makeNotifyStatus: "failed",
      makeNotifyError: (result?.message || "Email send failed").slice(0, 240),
      makeNotifyAttemptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    throw new Error(
      result?.message || "Failed to send order email. Please try again.",
    );
  }

  await updateDoc(orderDoc(id), {
    makeNotifyStatus: "sent",
    makeNotifiedAt: serverTimestamp(),
    makeNotifyAttemptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "order.email_sent",
    resourceType: "order",
    resourceId: id,
    newValue: { orderNumber: existing.orderNumber },
  });
}
