import { z } from "zod";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/constants/app";
import { addressSchema } from "./user.schema";

export const orderItemSchema = z
  .object({
    productId: z.string(),
    name: z.string().optional(),
    slug: z.string().optional(),
    image: z.string().optional(),
    variation: z.string().optional(),
    unitPrice: z.number().optional(),
    quantity: z.number().int().positive(),
    lineTotal: z.number().optional(),
  })
  .loose();

export const orderCustomerSchema = z
  .object({
    userId: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  })
  .loose();

export const orderTotalsSchema = z
  .object({
    subtotal: z.number().optional(),
    discount: z.number().optional(),
    shipping: z.number().optional(),
    deliveryFee: z.number().optional(),
    tax: z.number().optional(),
    total: z.number().optional(),
  })
  .loose();

export const orderDocumentSchema = z
  .object({
    orderNumber: z.string().optional(),
    reference: z.string().optional(),
    userId: z.string().optional(),
    customer: orderCustomerSchema.optional(),
    products: z.array(orderItemSchema).optional(),
    items: z.array(orderItemSchema).optional(),
    subtotal: z.number().optional(),
    deliveryFee: z.number().optional(),
    shipping: z.number().optional(),
    discount: z.number().optional(),
    tax: z.number().optional(),
    total: z.number().optional(),
    totals: orderTotalsSchema.optional(),
    paymentMethod: z.string().optional(),
    paymentStatus: z.enum(PAYMENT_STATUS).optional(),
    paymentReference: z.string().optional(),
    paymentId: z.string().optional(),
    couponCode: z.string().optional(),
    deliveryOptionId: z.string().optional(),
    orderStatus: z.enum(ORDER_STATUS).optional(),
    status: z.enum(ORDER_STATUS).optional(),
    shippingAddress: addressSchema.partial().optional(),
    trackingNumber: z.string().optional(),
    notes: z.string().optional(),
    timeline: z
      .array(
        z
          .object({
            event: z.string(),
            label: z.string(),
            description: z.string().optional(),
            at: z.any(),
          })
          .loose(),
      )
      .optional(),
    inventoryReserved: z.boolean().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
  })
  .loose();
