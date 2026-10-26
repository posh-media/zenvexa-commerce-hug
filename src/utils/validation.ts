import type { ZodType } from "zod";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9\s-]{7,15}$/;

export function isEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

export function isPhone(value: string) {
  return PHONE_PATTERN.test(value.trim());
}

export function isNonEmpty(value: string) {
  return value.trim().length > 0;
}

/**
 * Parse untrusted data (e.g. a Firestore document) and return undefined
 * instead of throwing when it does not match the schema.
 */
export function parseOrUndefined<T>(schema: ZodType<T>, data: unknown) {
  const result = schema.safeParse(data);
  return result.success ? result.data : undefined;
}

/** Flatten Zod issues into a field -> message map for form UIs. */
export function fieldErrors<T>(schema: ZodType<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}
