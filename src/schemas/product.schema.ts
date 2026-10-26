import { z } from "zod";
import { PRODUCT_TAGS, STOCK_STATUS } from "@/constants/app";

const firestoreDate = z.union([
  z.date(),
  z.string(),
  z.number(),
  z.object({ seconds: z.number(), nanoseconds: z.number() }),
  z.custom<{ toDate: () => Date }>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      typeof (value as { toDate?: unknown }).toDate === "function",
  ),
]);

export const embeddedProductReviewSchema = z.object({
  reviewBy: z.string(),
  rating: z.number(),
  comment: z.string(),
  nice: z.string().optional(),
  date: firestoreDate.optional(),
});

export const productSpecificationSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const productVariantOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  priceDelta: z.number().optional(),
  stock: z.number().optional(),
  sku: z.string().optional(),
});

/**
 * Tolerant schema for live `products` documents: unknown keys pass through
 * and every field is optional so legacy documents never fail to parse.
 */
export const productDocumentSchema = z
  .object({
    productName: z.string().optional(),
    description: z.string().optional(),
    specification: z.string().optional(),
    price: z.number().optional(),
    discount: z.number().optional(),
    currency: z.string().optional(),
    rating: z.number().optional(),
    imgs: z.array(z.string()).optional(),
    variation: z.array(z.string()).optional(),
    category: z.string().optional(),
    sponsored: z.boolean().optional(),
    officialStore: z.boolean().optional(),
    officalStore: z.boolean().optional(),
    reviews: z.array(embeddedProductReviewSchema).optional(),

    slug: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    brand: z.string().optional(),
    brandId: z.string().optional(),
    categoryId: z.string().optional(),
    subcategory: z.string().optional(),
    thumbnail: z.string().optional(),
    images: z.array(z.string()).optional(),
    stock: z.number().optional(),
    stockStatus: z.enum(STOCK_STATUS).optional(),
    reviewCount: z.number().optional(),
    specifications: z.array(productSpecificationSchema).optional(),
    variants: z.array(productVariantOptionSchema).optional(),
    tags: z.array(z.enum(PRODUCT_TAGS)).optional(),
    featured: z.boolean().optional(),
    trending: z.boolean().optional(),
    flashSale: z.boolean().optional(),
    bestSeller: z.boolean().optional(),
    active: z.boolean().optional(),

    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoKeywords: z.array(z.string()).optional(),
    searchKeywords: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),

    viewCount: z.number().optional(),
    salesCount: z.number().optional(),
    wishlistCount: z.number().optional(),

    createdAt: firestoreDate.optional(),
    updatedAt: firestoreDate.optional(),
  })
  .loose();

export type ProductDocumentInput = z.infer<typeof productDocumentSchema>;
