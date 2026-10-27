export const APP_NAME = "Zenvexa";

/** Firestore prices are whole Naira amounts by default. */
export const CURRENCY = {
  code: "NGN",
  locale: "en-NG",
  symbol: "\u20a6",
} as const;

export const PAGINATION = {
  productsPerPage: 24,
  reviewsPerPage: 10,
} as const;

export const PRODUCT_TAGS = [
  "flash-sale",
  "featured",
  "trending",
  "new",
  "best-seller",
  "special-offer",
] as const;

export type ProductTag = (typeof PRODUCT_TAGS)[number];

export const STOCK_STATUS = [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "preorder",
] as const;

export type StockStatus = (typeof STOCK_STATUS)[number];

export const LOW_STOCK_THRESHOLD = 5;

export const USER_ROLES = [
  "customer",
  "super_admin",
  "admin",
  "inventory_manager",
  "order_manager",
  "customer_support",
  "marketing_manager",
  "staff",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUS = ["active", "suspended", "deleted"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const ORDER_STATUS = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUS)[number];

export const PAYMENT_STATUS = [
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "expired",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PAYMENT_METHODS = [
  "paystack",
  "korapay",
  "squad",
  "monnify",
  "flutterwave",
  "bachs",
  "cash-on-delivery",
  /** @deprecated Prefer `paystack` — kept for legacy orders. */
  "card",
  "transfer",
  "wallet",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_GATEWAYS = [
  "paystack",
  "korapay",
  "squad",
  "monnify",
  "flutterwave",
  "bachs",
  "cod",
  "none",
] as const;

export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

/** Timeline event codes stored on orders. */
export const ORDER_TIMELINE_EVENTS = [
  "order_created",
  "payment_pending",
  "payment_processing",
  "payment_successful",
  "payment_failed",
  "payment_cancelled",
  "payment_expired",
  "order_confirmed",
  "preparing_shipment",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export type OrderTimelineEvent = (typeof ORDER_TIMELINE_EVENTS)[number];

export const NOTIFICATION_TYPES = [
  "order",
  "promo",
  "system",
  "wishlist",
  "account",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const COUPON_DISCOUNT_TYPES = ["percentage", "fixed"] as const;
export type CouponDiscountType = (typeof COUPON_DISCOUNT_TYPES)[number];

export const PRODUCT_FLAGS = [
  "sponsored",
  "officialStore",
  "featured",
  "trending",
  "flashSale",
  "bestSeller",
  "active",
] as const;

export type ProductFlag = (typeof PRODUCT_FLAGS)[number];

/** Derive stockStatus from a numeric stock count. */
export function stockStatusFromCount(
  stock: number | undefined | null,
): StockStatus {
  if (stock == null) return "out_of_stock";
  if (stock <= 0) return "out_of_stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}
