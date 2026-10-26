import type {

  OrderStatus,

  PaymentGateway,

  PaymentMethod,

  PaymentStatus,

} from "@/constants/app";

import type { FirestoreDate, Timestamps } from "./firestore";

import type { OrderTimelineEntry } from "./payment";

import type { Address } from "./user";



export type { OrderStatus, PaymentMethod, PaymentStatus };

export type { OrderTimelineEntry };



export type OrderItem = {

  productId: string;

  name?: string;

  slug?: string;

  image?: string;

  variation?: string;

  unitPrice?: number;

  quantity: number;

  lineTotal?: number;

};



export type OrderCustomer = {

  userId?: string;

  name?: string;

  email?: string;

  phone?: string;

};



export type OrderTotals = {

  subtotal?: number;

  discount?: number;

  shipping?: number;

  deliveryFee?: number;

  tax?: number;

  total?: number;

};



/** `orders` collection document. */

export type OrderDocument = Timestamps & {

  orderNumber?: string;

  /** Legacy reference alias for `orderNumber`. */

  reference?: string;

  userId: string;

  customer?: OrderCustomer;

  /** Primary line items. */

  products?: OrderItem[];

  /** Alias for `products`. */

  items?: OrderItem[];

  subtotal?: number;

  deliveryFee?: number;

  /** Alias for `deliveryFee`. */

  shipping?: number;

  discount?: number;

  tax?: number;

  total?: number;

  /** Nested totals object (compat with earlier shape). */

  totals?: OrderTotals;

  paymentMethod?: PaymentMethod | string;

  paymentStatus?: PaymentStatus;

  paymentReference?: string;

  paymentId?: string;

  /** Gateway used for the COD commitment fee (paystack/korapay/squad/monnify). */
  paymentGateway?: PaymentGateway | string;

  /** Timestamp when the order was fully paid. */
  paidAt?: FirestoreDate;

  /** Required COD commitment fee (25% of total, rounded up). */
  codCommitmentFee?: number;

  /** COD commitment fee amount verified as paid. */
  codAmountPaid?: number;

  /** Remaining balance the customer pays on delivery. */
  codBalance?: number;

  /** Status of the COD commitment fee payment. */
  commitmentFeeStatus?: PaymentStatus;

  /** Timestamp when the COD commitment fee was verified. */
  commitmentFeePaidAt?: FirestoreDate;

  couponCode?: string;

  deliveryOptionId?: string;

  /** Primary fulfilment status. */

  orderStatus?: OrderStatus;

  /** Alias for `orderStatus`. */

  status?: OrderStatus;

  shippingAddress?: Address;

  trackingNumber?: string;

  notes?: string;

  /** Ordered timeline of payment / fulfilment events. */

  timeline?: OrderTimelineEntry[];

  /** True once inventory has been decremented for this order. */

  inventoryReserved?: boolean;

  /** Make.com notification status */
  makeNotifyStatus?: string;

  /** Make.com notification timestamp */
  makeNotifiedAt?: unknown;

  /** Make.com notification error */
  makeNotifyError?: string;

  /** Make.com notification attempt timestamp */
  makeNotifyAttemptedAt?: unknown;

};



export type Order = OrderDocument & { id: string };


