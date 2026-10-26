import { z } from "zod";

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

export const categoryDocumentSchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    image: z.string().optional(),
    icon: z.string().optional(),
    parentId: z.string().nullable().optional(),
    subcategories: z.array(z.string()).optional(),
    productCount: z.number().optional(),
    featured: z.boolean().optional(),
    active: z.boolean().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    createdAt: firestoreDate.optional(),
    updatedAt: firestoreDate.optional(),
  })
  .loose();

export const brandDocumentSchema = z
  .object({
    name: z.string(),
    slug: z.string(),
    logo: z.string().optional(),
    logoUrl: z.string().optional(),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    productCount: z.number().optional(),
    featured: z.boolean().optional(),
    active: z.boolean().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    createdAt: firestoreDate.optional(),
    updatedAt: firestoreDate.optional(),
  })
  .loose();
