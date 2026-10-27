import { z } from "zod";
import { PAYMENT_GATEWAYS, PAYMENT_STATUS } from "@/constants/app";

export const paymentDocumentSchema = z
  .object({
    orderId: z.string(),
    orderNumber: z.string().optional(),
    userId: z.string(),
    gateway: z.enum(PAYMENT_GATEWAYS).optional(),
    reference: z.string(),
    amount: z.number().optional(),
    amountKobo: z.number().optional(),
    currency: z.string().optional(),
    status: z.enum(PAYMENT_STATUS).optional(),
    customerEmail: z.string().optional(),
    channel: z.string().optional(),
    gatewayResponse: z.record(z.string(), z.any()).optional(),
    authorization: z.record(z.string(), z.any()).optional(),
    paidAt: z.any().optional(),
    processedEventIds: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
  })
  .loose();

export const initializePaystackBodySchema = z.object({
  orderId: z.string().min(1),
  callbackUrl: z.string().url().optional(),
});

export const verifyPaystackBodySchema = z.object({
  reference: z.string().min(1),
});

export const confirmCodBodySchema = z.object({
  orderId: z.string().min(1),
});

export const initializeCodFeeBodySchema = z.object({
  orderId: z.string().min(1),
  gateway: z.enum(["paystack", "korapay", "squad", "monnify", "bachs"]),
});

export const reverifyBodySchema = z.object({
  orderId: z.string().min(1),
});
