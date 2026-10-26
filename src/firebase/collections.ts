import { collection, doc } from "firebase/firestore";
import { APP_SETTINGS_DOC_ID, COLLECTIONS } from "@/constants/collections";
import {
  addressConverter,
  brandConverter,
  cartConverter,
  categoryConverter,
  couponConverter,
  notificationConverter,
  orderConverter,
  paymentConverter,
  productConverter,
  reviewConverter,
  settingsConverter,
  userConverter,
  wishlistConverter,
} from "./converters";
import { getDb } from "./firestore";

export const productsCollection = () =>
  collection(getDb(), COLLECTIONS.products).withConverter(productConverter);

export const productDoc = (id: string) =>
  doc(getDb(), COLLECTIONS.products, id).withConverter(productConverter);

export const categoriesCollection = () =>
  collection(getDb(), COLLECTIONS.categories).withConverter(categoryConverter);

export const categoryDoc = (id: string) =>
  doc(getDb(), COLLECTIONS.categories, id).withConverter(categoryConverter);

export const brandsCollection = () =>
  collection(getDb(), COLLECTIONS.brands).withConverter(brandConverter);

export const brandDoc = (id: string) =>
  doc(getDb(), COLLECTIONS.brands, id).withConverter(brandConverter);

export const usersCollection = () =>
  collection(getDb(), COLLECTIONS.users).withConverter(userConverter);

export const userDoc = (uid: string) =>
  doc(getDb(), COLLECTIONS.users, uid).withConverter(userConverter);

export const addressesCollection = () =>
  collection(getDb(), COLLECTIONS.addresses).withConverter(addressConverter);

export const addressDoc = (id: string) =>
  doc(getDb(), COLLECTIONS.addresses, id).withConverter(addressConverter);

export const ordersCollection = () =>
  collection(getDb(), COLLECTIONS.orders).withConverter(orderConverter);

export const orderDoc = (id: string) =>
  doc(getDb(), COLLECTIONS.orders, id).withConverter(orderConverter);

export const cartsCollection = () =>
  collection(getDb(), COLLECTIONS.carts).withConverter(cartConverter);

export const cartDoc = (uid: string) =>
  doc(getDb(), COLLECTIONS.carts, uid).withConverter(cartConverter);

export const wishlistsCollection = () =>
  collection(getDb(), COLLECTIONS.wishlists).withConverter(wishlistConverter);

export const wishlistDoc = (uid: string) =>
  doc(getDb(), COLLECTIONS.wishlists, uid).withConverter(wishlistConverter);

export const reviewsCollection = () =>
  collection(getDb(), COLLECTIONS.reviews).withConverter(reviewConverter);

export const reviewDoc = (id: string) =>
  doc(getDb(), COLLECTIONS.reviews, id).withConverter(reviewConverter);

export const notificationsCollection = () =>
  collection(getDb(), COLLECTIONS.notifications).withConverter(
    notificationConverter,
  );

export const notificationDoc = (id: string) =>
  doc(getDb(), COLLECTIONS.notifications, id).withConverter(
    notificationConverter,
  );

export const couponsCollection = () =>
  collection(getDb(), COLLECTIONS.coupons).withConverter(couponConverter);

export const couponDoc = (id: string) =>
  doc(getDb(), COLLECTIONS.coupons, id).withConverter(couponConverter);

export const paymentsCollection = () =>
  collection(getDb(), COLLECTIONS.payments).withConverter(paymentConverter);

export const paymentDoc = (id: string) =>
  doc(getDb(), COLLECTIONS.payments, id).withConverter(paymentConverter);

export const settingsCollection = () =>
  collection(getDb(), COLLECTIONS.settings).withConverter(settingsConverter);

export const settingsDoc = (id: string = APP_SETTINGS_DOC_ID) =>
  doc(getDb(), COLLECTIONS.settings, id).withConverter(settingsConverter);
