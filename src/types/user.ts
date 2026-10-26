import type { UserRole, UserStatus } from "@/constants/app";
import type { FirestoreDate, Timestamps } from "./firestore";

/** Embedded address shape used by checkout / legacy user profiles. */
export type Address = {
  id?: string;
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  isDefault?: boolean;
};

export type { UserRole, UserStatus };

/**
 * Shape of a `users` document. Live docs may use snake_case
 * (`created_time`, `display_name`); camelCase fields are Zenvexa additions.
 */
export type UserDocument = Timestamps & {
  uid?: string;
  email?: string;
  display_name?: string;
  created_time?: FirestoreDate;

  displayName?: string;
  phone?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  role?: UserRole;
  status?: UserStatus;
  /** @deprecated Prefer the standalone `addresses` collection. */
  addresses?: Address[];
  defaultAddressId?: string;
  /** Recent search terms synced for authenticated users. */
  searchHistory?: string[];
  /** @deprecated Prefer `status`. */
  active?: boolean;
};

export type UserProfile = UserDocument & { id: string };
