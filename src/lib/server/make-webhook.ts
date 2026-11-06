import { recordStoreId } from "@/lib/store";
import { getAppUrl } from "@/lib/server/env";
import { COLLECTIONS } from "@/constants/collections";
import { getAdminDb } from "@/lib/server/firebase-admin";
import { paymentLog } from "@/lib/server/payment-log";
import {
  currentStoreId,
  deploymentEnv,
  privateIntegrationSettings,
} from "@/lib/server/store-context";
import type { Order, OrderItem } from "@/types/order";
import { FieldValue } from "firebase-admin/firestore";

async function getMakeWebhookUrl() {
  const privateSettings = await privateIntegrationSettings();
  if (privateSettings.makeWebhookUrl)
    return String(privateSettings.makeWebhookUrl);
  if (currentStoreId() === "shopbeta") {
    const legacy = (
      await getAdminDb().collection("settings").doc("app").get()
    ).data()?.notifications?.makeWebhookUrl;
    if (legacy) return String(legacy);
  }
  return (
    deploymentEnv("MAKE_WEBHOOK_URL") ||
    deploymentEnv("MAKE_COM_WEBHOOK_URL") ||
    ""
  );
}

function linePrice(item: OrderItem) {
  return Number(item.unitPrice ?? item.lineTotal ?? 0);
}

function lineSubtotal(item: OrderItem) {
  if (item.lineTotal != null) return Number(item.lineTotal);
  return linePrice(item) * Number(item.quantity ?? 0);
}

function formatAddress(order: Order) {
  const address = order.shippingAddress as
    | {
        fullName?: string;
        recipientName?: string;
        phone?: string;
        line1?: string;
        addressLine?: string;
        line2?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      }
    | undefined;
  if (!address) return "";
  return [
    address.recipientName || address.fullName,
    address.addressLine || address.line1,
    address.addressLine2 || address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function expectedDeliveryLabel(order: Order) {
  const raw =
    (order as Order & { expectedDelivery?: string; estimatedDelivery?: string })
      .expectedDelivery ||
    (order as Order & { estimatedDelivery?: string }).estimatedDelivery;
  if (raw) return String(raw);
  const option = String(order.deliveryOptionId ?? "");
  if (option.includes("express") || option.includes("next")) {
    return "Next business day";
  }
  if (option.includes("same")) return "Same day";
  return "3–5 business days";
}

export type MakeOrderPayload = {
  storeId: string | null;
  storeName: string;
  storefrontUrl: string;
  customerName: string;
  customerEmail: string;
  phoneNumber: string;
  orderId: string;
  orderDate: string;
  expectedDelivery: string;
  shippingAddress: string;
  products: Array<{
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  totalPrice: number;
  paymentStatus: string;
  paymentMethod: string;
  currency: string;
  reference: string;
  orderStatus: string;
};

export function buildMakeOrderPayload(
  order: Order,
  reference: string,
): MakeOrderPayload {
  const lines = (order.products ?? order.items ?? []) as OrderItem[];
  const products = lines.map((item) => ({
    productName: item.name || item.productId,
    quantity: Number(item.quantity ?? 0),
    price: linePrice(item),
    subtotal: lineSubtotal(item),
  }));

  const created =
    order.createdAt instanceof Date
      ? order.createdAt.toISOString()
      : new Date().toISOString();

  return {
    storeId: recordStoreId(order),
    storeName:
      order.storeName ||
      (recordStoreId(order) === "shopbeta" ? "ShopBeta" : ""),
    storefrontUrl: getAppUrl(),
    customerName: order.customer?.name || "Customer",
    customerEmail: order.customer?.email || "",
    phoneNumber:
      order.customer?.phone ||
      (order.shippingAddress as { phone?: string } | undefined)?.phone ||
      "",
    orderId: order.orderNumber || order.id,
    orderDate: created,
    expectedDelivery: expectedDeliveryLabel(order),
    shippingAddress: formatAddress(order),
    products,
    subtotal: Number(order.subtotal ?? order.totals?.subtotal ?? 0),
    deliveryFee: Number(
      order.deliveryFee ??
        order.shipping ??
        order.totals?.deliveryFee ??
        order.totals?.shipping ??
        0,
    ),
    discount: Number(order.discount ?? order.totals?.discount ?? 0),
    totalPrice: Number(order.total ?? order.totals?.total ?? 0),
    paymentStatus: String(order.paymentStatus ?? "paid"),
    paymentMethod: String(order.paymentMethod ?? "paystack"),
    currency: "NGN",
    reference,
    orderStatus: String(order.orderStatus ?? order.status ?? "paid"),
  };
}

/**
 * Notify Make.com after Firestore payment success.
 * Failures are logged only — never fail the Paystack webhook response.
 * Marks the order so successful notifies are not duplicated; failures stay retryable.
 */
export async function notifyMakeOrderPaid(input: {
  order: Order;
  reference: string;
  force?: boolean;
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const url = await getMakeWebhookUrl();
  if (!url) {
    paymentLog("webhook.make", "Make.com URL not configured — skipped", {
      orderId: input.order.id,
    });
    return { ok: false, skipped: true, reason: "not_configured" };
  }

  const db = getAdminDb();
  const orderRef = db.collection(COLLECTIONS.orders).doc(input.order.id);
  const snap = await orderRef.get();
  const latest = snap.exists
    ? ({ id: snap.id, ...snap.data() } as Order & {
        makeNotifiedAt?: unknown;
        makeNotifyStatus?: string;
      })
    : (input.order as Order & {
        makeNotifiedAt?: unknown;
        makeNotifyStatus?: string;
      });

  if (
    !input.force &&
    latest.makeNotifyStatus === "sent" &&
    latest.makeNotifiedAt
  ) {
    paymentLog("webhook.make", "Make.com already notified — skipped", {
      orderId: input.order.id,
      reference: input.reference,
    });
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  const claimed = await db.runTransaction(async (tx) => {
    const current = await tx.get(orderRef);
    const data = current.data();
    if (!data || !["paid", "success"].includes(String(data.paymentStatus))) return false;
    if ((!input.force && data.makeNotifyStatus === "sent") || data.makeNotifyStatus === "sending") return false;
    tx.update(orderRef, { makeNotifyStatus: "sending", makeNotifyAttemptedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!claimed) return { ok: true, skipped: true, reason: "already_sent_or_in_progress" };

  const payload = buildMakeOrderPayload(
    { ...input.order, ...latest, id: input.order.id },
    input.reference,
  );
  const eventId = `${payload.storeId}:${input.order.id}:payment-confirmed`;

  paymentLog("webhook.make", "Sending Make.com webhook", {
    orderId: input.order.id,
    reference: input.reference,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": eventId,
      },
      body: JSON.stringify({ ...payload, eventId }),
      cache: "no-store",
    });

    if (!response.ok) {
      await orderRef.set(
        {
          makeNotifyStatus: "failed",
          makeNotifyError: `HTTP ${response.status}`,
          makeNotifyAttemptedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      paymentLog("webhook.make", "Make.com webhook failed", {
        orderId: input.order.id,
        status: response.status,
      });
      return { ok: false, reason: `http_${response.status}` };
    }

    await orderRef.set(
      {
        makeNotifyStatus: "sent",
        makeNotifiedAt: FieldValue.serverTimestamp(),
        makeNotifyError: FieldValue.delete(),
        makeNotifyAttemptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    paymentLog("webhook.make", "Make.com webhook succeeded", {
      orderId: input.order.id,
      reference: input.reference,
    });
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Make request failed";
    await orderRef.set(
      {
        makeNotifyStatus: "failed",
        makeNotifyError: message.slice(0, 240),
        makeNotifyAttemptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    paymentLog("webhook.make", "Make.com webhook exception", {
      orderId: input.order.id,
      message,
    });
    return { ok: false, reason: message };
  }
}
