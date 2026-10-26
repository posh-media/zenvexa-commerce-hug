import type { NotificationType } from "@/constants/app";
import type { Timestamps } from "./firestore";

export type CartItem = {
  productId: string;
  quantity: number;
  variation?: string;
  /** Price captured when the item was added, for change detection. */
  unitPrice?: number;
};

/** Planned `carts` collection, one document per user. */
export type CartDocument = Timestamps & {
  userId: string;
  /** Primary line-item array. */
  products?: CartItem[];
  /** Legacy alias for `products`. */
  items?: CartItem[];
  subtotal?: number;
};

export type Cart = CartDocument & { id: string };

export type WishlistItem = {
  productId: string;
  addedAt?: Timestamps["createdAt"];
};

/** Planned `wishlists` collection, one document per user. */
export type WishlistDocument = Timestamps & {
  userId: string;
  /** Primary product id list. */
  productIds?: string[];
  /** Legacy alias for structured items. */
  items?: WishlistItem[];
};

export type Wishlist = WishlistDocument & { id: string };

/** Planned standalone `reviews` collection (reviews are embedded today). */
export type ReviewDocument = Timestamps & {
  productId: string;
  userId?: string;
  /** Legacy display name field. */
  reviewBy?: string;
  rating: number;
  title?: string;
  /** Primary review body. */
  review?: string;
  /** Alias for `review`. */
  comment?: string;
  images?: string[];
  verifiedPurchase?: boolean;
  helpfulCount?: number;
  approved?: boolean;
};

export type Review = ReviewDocument & { id: string };

export type NotificationKind = NotificationType;

/** Planned `notifications` collection. */
export type NotificationDocument = Timestamps & {
  userId: string;
  title: string;
  /** Primary message body. */
  message?: string;
  /** Alias for `message`. */
  body?: string;
  /** Primary notification type. */
  type?: NotificationKind | string;
  /** Alias for `type`. */
  kind?: NotificationKind;
  href?: string;
  read?: boolean;
};

export type AppNotification = NotificationDocument & { id: string };
