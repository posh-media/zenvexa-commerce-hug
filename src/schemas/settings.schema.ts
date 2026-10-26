import { z } from "zod";

export const currencyOptionSchema = z
  .object({
    code: z.string(),
    symbol: z.string().optional(),
    name: z.string().optional(),
    rate: z.number().optional(),
    default: z.boolean().optional(),
  })
  .loose();

export const deliveryOptionSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    fee: z.number().optional(),
    estimatedDays: z.string().optional(),
    active: z.boolean().optional(),
  })
  .loose();

export const storeInformationSchema = z
  .object({
    name: z.string().optional(),
    tagline: z.string().optional(),
    logoUrl: z.string().optional(),
    address: z.string().optional(),
  })
  .loose();

export const contactDetailsSchema = z
  .object({
    email: z.string().optional(),
    phone: z.string().optional(),
    whatsapp: z.string().optional(),
    supportHours: z.string().optional(),
  })
  .loose();

export const socialLinksSchema = z
  .object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional(),
  })
  .loose();

export const appSettingsDocumentSchema = z
  .object({
    currencies: z.array(currencyOptionSchema).optional(),
    deliveryOptions: z.array(deliveryOptionSchema).optional(),
    supportedCountries: z.array(z.string()).optional(),
    storeInformation: storeInformationSchema.optional(),
    contactDetails: contactDetailsSchema.optional(),
    socialLinks: socialLinksSchema.optional(),
    updatedAt: z.any().optional(),
  })
  .loose();
