import { z } from "zod";
import { USER_ROLES, USER_STATUS } from "@/constants/app";

/** Embedded address shape (checkout / legacy user profile). */
export const addressSchema = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  fullName: z.string().min(2),
  phone: z.string().min(7),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(2),
  isDefault: z.boolean().optional(),
});

export const userDocumentSchema = z
  .object({
    uid: z.string().optional(),
    email: z.string().email().optional(),
    display_name: z.string().optional(),
    created_time: z.any().optional(),
    displayName: z.string().optional(),
    phone: z.string().optional(),
    photoUrl: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUS).optional(),
    addresses: z.array(addressSchema).optional(),
    defaultAddressId: z.string().optional(),
    searchHistory: z.array(z.string()).optional(),
    active: z.boolean().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
  })
  .loose();

export type AddressInput = z.infer<typeof addressSchema>;
