/**
 * Dedicated server-side transactional email service.
 *
 * Sends generic transactional email requests to a dedicated Make.com webhook
 * (separate from the payment/order automation webhook).
 *
 * Architecture:
 *   Admin UI → /api/transactional-email → sendTransactionalEmail() → Make.com
 *
 * The browser never calls Make.com directly.
 */
import type { Order, OrderItem } from "@/types/order";

export const TRANSACTIONAL_EMAIL_TYPES = [
  "order_confirmation",
  "payment_confirmation",
  "delivery_update",
  "delivered",
  "refund",
  "cancellation",
  "failed_payment",
] as const;

export type TransactionalEmailType = (typeof TRANSACTIONAL_EMAIL_TYPES)[number];

export function isTransactionalEmailType(
  value: unknown,
): value is TransactionalEmailType {
  return (
    typeof value === "string" &&
    (TRANSACTIONAL_EMAIL_TYPES as readonly string[]).includes(value)
  );
}

function emailLog(message: string, meta?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      transactionalEmail: {
        at: new Date().toISOString(),
        message,
        ...meta,
      },
    }),
  );
}

/**
 * Resolve the transactional-email Make.com webhook URL.
 * Priority: Firestore settings → environment variable → "" (not configured).
 */
export async function getTransactionalEmailWebhookUrl(): Promise<string> {
  try {
    const { getAppSettings } = await import("@/services/settings.service");
    const settings = await getAppSettings();
    const url = settings?.notifications?.transactionalEmailWebhookUrl?.trim();
    if (url) return url;
  } catch (error) {
    emailLog("settings lookup failed — falling back to env", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }

  return (
    process.env.MAKE_TRANSACTIONAL_WEBHOOK_URL?.trim() ||
    process.env.TRANSACTIONAL_EMAIL_WEBHOOK_URL?.trim() ||
    ""
  );
}

async function getSupportEmail(): Promise<string> {
  try {
    const { getAppSettings } = await import("@/services/settings.service");
    const settings = await getAppSettings();
    return (
      settings?.contactDetails?.email?.trim() ||
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
      ""
    );
  } catch {
    return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";
  }
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

function orderDateIso(order: Order): string {
  const created = order.createdAt;
  if (created instanceof Date) return created.toISOString();
  if (created && typeof created === "object" && "toDate" in created) {
    return (created as { toDate: () => Date }).toDate().toISOString();
  }
  if (created && typeof created === "object" && "seconds" in created) {
    const secs = (created as { seconds?: number }).seconds;
    if (typeof secs === "number") return new Date(secs * 1000).toISOString();
  }
  if (typeof created === "string" || typeof created === "number") {
    const d = new Date(created);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

export type TransactionalEmailPayload = {
  emailType: TransactionalEmailType;
  recipientEmail: string;
  customerName: string;
  customerEmail: string;
  phoneNumber: string;
  orderId: string;
  orderDate: string;
  expectedDelivery: string;
  shippingAddress: string;
  subtotal: number;
  products: Array<{
    productName: string;
    quantity: number;
    price: number;
    subtotal: number;
  }>;
  deliveryFee: number;
  discount: number;
  totalPrice: number;
  paymentStatus: string;
  paymentMethod: string;
  currency: string;
  reference: string;
  orderStatus: string;
  supportEmail: string;
};

export async function buildTransactionalEmailPayload(input: {
  emailType: TransactionalEmailType;
  order: Order;
  reference?: string;
  recipientOverride?: string;
}): Promise<TransactionalEmailPayload> {
  const { order, emailType } = input;
  const lines = (order.products ?? order.items ?? []) as OrderItem[];
  const products = lines.map((item) => ({
    productName: item.name || item.productId,
    quantity: Number(item.quantity ?? 0),
    price: linePrice(item),
    subtotal: lineSubtotal(item),
  }));

  const customerEmail = order.customer?.email || "";
  const supportEmail = await getSupportEmail();

  return {
    emailType,
    recipientEmail: input.recipientOverride?.trim() || customerEmail,
    customerName: order.customer?.name || "Customer",
    customerEmail,
    phoneNumber:
      order.customer?.phone ||
      (order.shippingAddress as { phone?: string } | undefined)?.phone ||
      "",
    orderId: order.orderNumber || order.id,
    orderDate: orderDateIso(order),
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
    paymentStatus: String(order.paymentStatus ?? ""),
    paymentMethod: String(order.paymentMethod ?? ""),
    currency: "NGN",
    reference: input.reference || order.paymentReference || order.orderNumber || order.id,
    orderStatus: String(order.orderStatus ?? order.status ?? ""),
    supportEmail,
  };
}

export type TransactionalEmailResult =
  | { ok: true }
  | { ok: false; reason: string; code?: string };

/**
 * Send a transactional email request to the dedicated Make.com webhook.
 * Never reports success unless Make.com responded successfully.
 */
export async function sendTransactionalEmail(input: {
  emailType: TransactionalEmailType;
  order: Order;
  reference?: string;
  recipientOverride?: string;
}): Promise<TransactionalEmailResult> {
  const orderId = input.order.orderNumber || input.order.id;

  emailLog("Transactional email requested", {
    emailType: input.emailType,
    orderId,
    recipient: input.recipientOverride || input.order.customer?.email || "",
  });

  const url = await getTransactionalEmailWebhookUrl();
  if (!url) {
    emailLog("Transactional email webhook URL not configured", { orderId });
    return { ok: false, reason: "not_configured", code: "not_configured" };
  }

  const payload = await buildTransactionalEmailPayload(input);
  if (!payload.recipientEmail) {
    return { ok: false, reason: "missing_recipient", code: "missing_recipient" };
  }

  emailLog("Make webhook request started", {
    emailType: input.emailType,
    orderId,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    emailLog("Make webhook response received", {
      emailType: input.emailType,
      orderId,
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      emailLog("Make webhook request failed", {
        orderId,
        status: response.status,
        body: body.slice(0, 200),
      });
      return {
        ok: false,
        reason: `http_${response.status}`,
        code: "webhook_rejected",
      };
    }

    emailLog("Make webhook request succeeded", {
      emailType: input.emailType,
      orderId,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    emailLog("Make webhook request exception", { orderId, message });
    return { ok: false, reason: message, code: "network_error" };
  }
}
