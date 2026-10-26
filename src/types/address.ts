import type { Timestamps } from "./firestore";

/** Standalone `addresses` collection document. */
export type AddressDocument = Timestamps & {
  userId: string;
  recipientName: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  addressLine: string;
  postalCode: string;
  landmark?: string;
  default?: boolean;
};

/** Standalone address document with Firestore id. */
export type Address = AddressDocument & { id: string };
