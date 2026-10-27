import type { FirestoreDate } from "./firestore";

export type CurrencyOption = {
  code: string;
  symbol?: string;
  name?: string;
  rate?: number;
  default?: boolean;
};

export type DeliveryOption = {
  id?: string;
  name: string;
  fee?: number;
  estimatedDays?: string;
  active?: boolean;
};

export type StoreInformation = {
  name?: string;
  tagline?: string;
  logoUrl?: string;
  address?: string;
};

export type ContactDetails = {
  email?: string;
  phone?: string;
  whatsapp?: string;
  supportHours?: string;
};

export type SocialLinks = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  [key: string]: string | undefined;
};

/** Singleton `settings/app` document. */
export type AppSettingsDocument = {
  currencies?: CurrencyOption[];
  deliveryOptions?: DeliveryOption[];
  supportedCountries?: string[];
  storeInformation?: StoreInformation;
  contactDetails?: ContactDetails;
  socialLinks?: SocialLinks;
  /** Public payment toggles — never store secret keys here. */
  payments?: {
    monnifyEnabled?: boolean;
    monnifySandbox?: boolean;
    squadEnabled?: boolean;
    squadSandbox?: boolean;
    codEnabled?: boolean;
    paystackEnabled?: boolean;
    korapayEnabled?: boolean;
    flutterwaveEnabled?: boolean;
    bachsEnabled?: boolean;
    bachsSandbox?: boolean;
    paystackPublicKeyHint?: string;
    /** States/regions where Payment on Delivery is allowed. */
    paymentOnDeliveryAllowedStates?: string[];
  };
  /** Secret payment keys — server-side only, never expose to client */
  paymentSecrets?: {
    paystackSecretKey?: string;
    korapaySecretKey?: string;
    flutterwaveSecretKey?: string;
  };
  notifications?: {
    orderEmailEnabled?: boolean;
    promoPushEnabled?: boolean;
    makeWebhookUrl?: string;
    transactionalEmailWebhookUrl?: string;
  };
  theme?: {
    brandColor?: string;
    defaultBannerId?: string;
  };
  taxRate?: number;
  updatedAt?: FirestoreDate;
};

export type AppSettings = AppSettingsDocument & { id: string };
