import type { FirestoreDate } from "./firestore";

export const EXPENSE_TYPES = ["ads", "other_expense"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

/** Expense record (advertising or other business expense) */
export type AdDocument = {
  storeId?: "shopbeta" | "zenvexa";

  /** Missing on legacy records — treat as "ads". */
  type?: ExpenseType;
  platform: string;
  campaignName?: string;
  amount: number;
  date: string; // YYYY-MM-DD format
  description?: string;
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

export type Ad = AdDocument & { id: string };

/** Form input type for creating/editing ads */
export type AdInput = {
  type?: ExpenseType;
  platform: string;
  campaignName?: string;
  amount: string;
  date: string;
  description?: string;
};

/** Validation result for ad input */
export type AdValidationResult = {
  ok: boolean;
  reason?: string;
};
