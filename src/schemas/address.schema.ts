import { z } from "zod";

/** Standalone `addresses` collection document. */
export const addressDocumentSchema = z
  .object({
    userId: z.string().optional(),
    recipientName: z.string().optional(),
    phone: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    addressLine: z.string().optional(),
    postalCode: z.string().optional(),
    landmark: z.string().optional(),
    default: z.boolean().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
  })
  .loose();
