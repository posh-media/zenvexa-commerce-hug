import type { CouponDiscountType } from "@/constants/app";
import type { FirestoreDate, Timestamps } from "./firestore";

export type DiscountType = CouponDiscountType;

/** Planned `coupons` collection document. */
export type CouponDocument = Timestamps & {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  startDate?: FirestoreDate;
  endDate?: FirestoreDate;
  usageLimit?: number;
  usedCount?: number;
  /** Minimum subtotal required before the coupon applies. */
  minimumPurchase?: number;
  /** Cap for percentage discounts (major currency units). */
  maximumDiscount?: number;
  active?: boolean;
};

export type Coupon = CouponDocument & { id: string };
