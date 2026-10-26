import type { FirestoreDate, Timestamps } from "./firestore";
import type { ProductTag, StockStatus } from "@/constants/app";

/** Review embedded in the existing `products` documents. */
export type EmbeddedProductReview = {
  reviewBy: string;
  rating: number;
  comment: string;
  /** Short headline stored as `nice` in the existing documents. */
  nice?: string;
  date?: FirestoreDate;
};

export type ProductVariantOption = {
  label: string;
  value: string;
  priceDelta?: number;
  stock?: number;
  sku?: string;
};

export type ProductSpecification = {
  label: string;
  value: string;
};

/**
 * Shape of a `products` document in Firestore.
 * Every field is optional at the document layer because live data is additive
 * and legacy documents are incomplete. Converters supply defaults on read.
 */
export type ProductDocument = Timestamps & {
  productName?: string;
  description?: string;
  /** Free-form "Label: value" block, newline separated (legacy). */
  specification?: string;
  price?: number;
  /** Percentage off, 0-100. */
  discount?: number;
  /** ISO currency code; defaults to NGN. */
  currency?: string;
  rating?: number;
  imgs?: string[];
  variation?: string[];
  category?: string;
  sponsored?: boolean;
  officialStore?: boolean;
  /** Legacy misspelling still present on some documents. */
  officalStore?: boolean;
  reviews?: EmbeddedProductReview[];

  slug?: string;
  sku?: string;
  barcode?: string;
  brand?: string;
  brandId?: string;
  categoryId?: string;
  subcategory?: string;
  thumbnail?: string;
  images?: string[];
  stock?: number;
  stockStatus?: StockStatus;
  reviewCount?: number;
  specifications?: ProductSpecification[];
  variants?: ProductVariantOption[];
  tags?: ProductTag[];
  featured?: boolean;
  trending?: boolean;
  flashSale?: boolean;
  bestSeller?: boolean;
  active?: boolean;

  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  searchKeywords?: string[];
  keywords?: string[];

  viewCount?: number;
  salesCount?: number;
  wishlistCount?: number;
};

/** Normalized product used by the app layer. */
export type Product = {
  id: string;
  name: string;
  productName: string;
  slug: string;
  description: string;
  price: number;
  discount: number;
  currency: string;
  /** Price before discount, derived from `price` and `discount`. */
  oldPrice?: number;
  rating: number;
  reviewCount: number;
  images: string[];
  thumbnail?: string;
  category?: string;
  categoryId?: string;
  brand?: string;
  brandId?: string;
  stock: number;
  stockStatus: StockStatus;
  sku?: string;
  barcode?: string;
  /** Legacy `variation` strings, kept for UI colour/variant pickers. */
  variations: string[];
  variants: ProductVariantOption[];
  specifications: ProductSpecification[];
  /** Legacy free-text specification block when present. */
  specification?: string;
  reviews: EmbeddedProductReview[];
  sponsored: boolean;
  officialStore: boolean;
  tags: ProductTag[];
  featured: boolean;
  trending: boolean;
  flashSale: boolean;
  bestSeller: boolean;
  active: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords: string[];
  searchKeywords: string[];
  viewCount: number;
  salesCount: number;
  wishlistCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};
