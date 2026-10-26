import type {
  AddressDocument,
  AppSettingsDocument,
  CartDocument,
  CouponDocument,
  NotificationDocument,
  OrderDocument,
  PaymentDocument,
  ReviewDocument,
  UserDocument,
  WishlistDocument,
} from "@/types";
import { createConverter } from "./generic";

export { createConverter } from "./generic";
export {
  productConverter,
  toProduct,
  toProductDocument,
} from "./product";
export {
  brandConverter,
  categoryConverter,
  toBrand,
  toCategory,
} from "./catalog";

export const userConverter = createConverter<UserDocument>();
export const addressConverter = createConverter<AddressDocument>();
export const orderConverter = createConverter<OrderDocument>();
export const cartConverter = createConverter<CartDocument>();
export const wishlistConverter = createConverter<WishlistDocument>();
export const reviewConverter = createConverter<ReviewDocument>();
export const notificationConverter = createConverter<NotificationDocument>();
export const couponConverter = createConverter<CouponDocument>();
export const paymentConverter = createConverter<PaymentDocument>();
export const settingsConverter = createConverter<AppSettingsDocument>();
