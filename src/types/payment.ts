import type {
  OrderTimelineEvent,
  PaymentGateway,
  PaymentStatus,
} from "@/constants/app";
import type { FirestoreDate, Timestamps } from "./firestore";

/** Single entry on an order's fulfilment / payment timeline. */
export type OrderTimelineEntry = {
  event: OrderTimelineEvent | string;
  label: string;
  description?: string | null;
  at: FirestoreDate;
};

/** `payments` collection document. */
export type PaymentDocument = Timestamps & {
  orderId: string;
  orderNumber?: string;
  userId: string;
  gateway: PaymentGateway;
  reference: string;
  /** Amount in major currency units (Naira). */
  amount: number;
  /** Amount in kobo for Paystack. */
  amountKobo?: number;
  currency: string;
  status: PaymentStatus;
  customerEmail?: string;
  channel?: string;
  gatewayResponse?: Record<string, unknown>;
  authorization?: Record<string, unknown>;
  paidAt?: FirestoreDate;
  /** Webhook event ids already processed (idempotency). */
  processedEventIds?: string[];
  /** Full Paystack verify response snapshot. */
  verificationData?: Record<string, unknown>;
  verifiedAt?: FirestoreDate;
  metadata?: Record<string, unknown>;
};

export type Payment = PaymentDocument & { id: string };

export type NormalizedPaymentResult = {
  reference: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  gateway: PaymentGateway;
  paidAt?: string;
  channel?: string;
  customerEmail?: string;
  gatewayResponse?: Record<string, unknown>;
  authorization?: Record<string, unknown>;
};
