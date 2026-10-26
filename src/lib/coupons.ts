import type { FirestoreDate } from "@/types/firestore";
import type { Coupon } from "@/types/coupon";
import { getCouponByCode } from "@/services/coupons.service";

export type CouponValidationResult =
  | {
      ok: true;
      coupon: Coupon;
      discount: number;
      message: string;
    }
  | { ok: false; reason: string };

function toMillis(value: FirestoreDate | undefined): number | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (typeof value === "object" && "toDate" in value) {
    return value.toDate().getTime();
  }
  return undefined;
}

export function calculateCouponDiscount(
  coupon: Coupon,
  subtotal: number,
): number {
  if (subtotal <= 0) return 0;
  if (coupon.discountType === "percentage") {
    return Math.min(
      subtotal,
      Math.round((subtotal * coupon.discountValue) / 100),
    );
  }
  return Math.min(subtotal, Math.round(coupon.discountValue));
}

export function validateCouponDocument(
  coupon: Coupon,
  subtotal: number,
  now = Date.now(),
): CouponValidationResult {
  if (coupon.active === false) {
    return { ok: false, reason: "This coupon is no longer active." };
  }

  const start = toMillis(coupon.startDate);
  const end = toMillis(coupon.endDate);
  if (start != null && now < start) {
    return { ok: false, reason: "This coupon is not active yet." };
  }
  if (end != null && now > end) {
    return { ok: false, reason: "This coupon has expired." };
  }

  if (
    coupon.usageLimit != null &&
    coupon.usedCount != null &&
    coupon.usedCount >= coupon.usageLimit
  ) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }

  const minimum = coupon.minimumPurchase ?? 0;
  if (subtotal < minimum) {
    return {
      ok: false,
      reason: `Spend at least ${minimum.toLocaleString()} to use this coupon.`,
    };
  }

  const discount = calculateCouponDiscount(coupon, subtotal);
  if (discount <= 0) {
    return { ok: false, reason: "This coupon does not apply to your cart." };
  }

  return {
    ok: true,
    coupon,
    discount,
    message:
      coupon.discountType === "percentage"
        ? `${coupon.discountValue}% off applied`
        : `Discount of ${discount.toLocaleString()} applied`,
  };
}

/**
 * Validate a coupon code against Firestore, with a local BETA10 fallback
 * when the coupons collection is empty or inaccessible.
 */
export async function applyCouponCode(
  code: string,
  subtotal: number,
): Promise<CouponValidationResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { ok: false, reason: "Enter a coupon code." };
  }

  try {
    const remote = await getCouponByCode(normalized);
    if (remote) {
      return validateCouponDocument(
        { ...remote, code: remote.code.toUpperCase() },
        subtotal,
      );
    }
  } catch {
    // Fall through to local stub when Firestore rules block reads.
  }

  // Demo fallback for environments without seeded coupons.
  if (normalized === "BETA10") {
    const stub: Coupon = {
      id: "beta10",
      code: "BETA10",
      description: "10% off up to ₦5,000",
      discountType: "percentage",
      discountValue: 10,
      minimumPurchase: 0,
      active: true,
    };
    const result = validateCouponDocument(stub, subtotal);
    if (result.ok) {
      return {
        ...result,
        discount: Math.min(5_000, result.discount),
        message: "BETA10 applied (10% off, max ₦5,000)",
      };
    }
    return result;
  }

  return { ok: false, reason: "Coupon code not found." };
}
