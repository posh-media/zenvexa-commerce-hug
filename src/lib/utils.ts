import clsx, { type ClassValue } from "clsx";

export { discountPercent, formatPrice } from "@/utils/currency";
export { slugify } from "@/utils/string";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
