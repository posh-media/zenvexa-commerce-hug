import type { FirestoreDate, Timestamps } from "./firestore";

export const BANNER_PLACEMENTS = [
  "home",
  "promo",
  "flash-sale",
  "campaign",
] as const;

export type BannerPlacement = (typeof BANNER_PLACEMENTS)[number];

/** `banners` collection. */
export type BannerDocument = Timestamps & {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  imageUrl?: string;
  href?: string;
  placement?: BannerPlacement | string;
  active?: boolean;
  displayOrder?: number;
  startDate?: FirestoreDate;
  endDate?: FirestoreDate;
};

export type Banner = BannerDocument & { id: string };

/** `auditLogs` collection. */
export type AuditLogDocument = Timestamps & {
  actorId: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  meta?: Record<string, unknown>;
};

export type AuditLog = AuditLogDocument & { id: string };
