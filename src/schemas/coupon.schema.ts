import { z } from "zod";
import { COUPON_DISCOUNT_TYPES } from "@/constants/app";

export const couponDocumentSchema = z
  .object({
    code: z.string().optional(),
    description: z.string().optional(),
    discountType: z.enum(COUPON_DISCOUNT_TYPES).optional(),
    discountValue: z.number().optional(),
    startDate: z.any().optional(),
    endDate: z.any().optional(),
    usageLimit: z.number().optional(),
    usedCount: z.number().optional(),
    minimumPurchase: z.number().optional(),
    active: z.boolean().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
  })
  .loose();
