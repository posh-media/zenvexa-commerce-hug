import { CURRENCY } from "@/constants/app";

/** Whole-Naira formatting, e.g. 127500 -> "₦127,500". */
export function formatPrice(value: number) {
  return new Intl.NumberFormat(CURRENCY.locale, {
    style: "currency",
    currency: CURRENCY.code,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(value);
}

export function discountPercent(price: number, oldPrice?: number) {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

/** Original price implied by a discounted price and a discount percentage. */
export function priceBeforeDiscount(price: number, discount?: number) {
  if (!discount || discount <= 0 || discount >= 100) return undefined;
  return Math.round(price / (1 - discount / 100));
}

export function applyDiscount(price: number, discount?: number) {
  if (!discount || discount <= 0) return price;
  return Math.max(0, Math.round(price * (1 - discount / 100)));
}
