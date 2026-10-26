import { z } from "zod";
import { NOTIFICATION_TYPES } from "@/constants/app";

export const cartItemSchema = z
  .object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    variation: z.string().optional(),
    unitPrice: z.number().optional(),
  })
  .loose();

export const cartDocumentSchema = z
  .object({
    userId: z.string().optional(),
    products: z.array(cartItemSchema).optional(),
    items: z.array(cartItemSchema).optional(),
    subtotal: z.number().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
  })
  .loose();

export const wishlistItemSchema = z
  .object({
    productId: z.string(),
    addedAt: z.any().optional(),
  })
  .loose();

export const wishlistDocumentSchema = z
  .object({
    userId: z.string().optional(),
    productIds: z.array(z.string()).optional(),
    items: z.array(wishlistItemSchema).optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
  })
  .loose();

export const reviewDocumentSchema = z
  .object({
    productId: z.string().optional(),
    userId: z.string().optional(),
    reviewBy: z.string().optional(),
    rating: z.number().optional(),
    title: z.string().optional(),
    review: z.string().optional(),
    comment: z.string().optional(),
    images: z.array(z.string()).optional(),
    verifiedPurchase: z.boolean().optional(),
    helpfulCount: z.number().optional(),
    approved: z.boolean().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
  })
  .loose();

export const notificationDocumentSchema = z
  .object({
    userId: z.string().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
    body: z.string().optional(),
    type: z.enum(NOTIFICATION_TYPES).or(z.string()).optional(),
    kind: z.enum(NOTIFICATION_TYPES).optional(),
    href: z.string().optional(),
    read: z.boolean().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
  })
  .loose();
