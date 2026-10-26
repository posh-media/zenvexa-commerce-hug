import type { Timestamps } from "./firestore";

/** `categories` collection. */
export type CategoryDocument = Timestamps & {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  parentId?: string | null;
  subcategories?: string[];
  productCount?: number;
  featured?: boolean;
  active?: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

export type Category = CategoryDocument & { id: string };

/** `brands` collection. */
export type BrandDocument = Timestamps & {
  name: string;
  slug: string;
  /** Empty when a logo is unavailable. */
  logo?: string;
  /** Legacy alias retained for compatibility. */
  logoUrl?: string;
  description?: string;
  categoryId?: string;
  productCount?: number;
  featured?: boolean;
  active?: boolean;
  seoTitle?: string;
  seoDescription?: string;
};

export type Brand = BrandDocument & { id: string };
