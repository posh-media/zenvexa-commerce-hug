import { Timestamp } from "firebase/firestore";
import type { FirestoreDate } from "@/types/firestore";

/** Normalize any Firestore date representation to a JS Date. */
export function toDate(value: FirestoreDate | null | undefined) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function toTimestamp(value: Date | undefined) {
  return value ? Timestamp.fromDate(value) : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively remove `undefined` values before Firestore writes.
 * Preserves Date, Timestamp, FieldValue, DocumentReference, and other
 * non-plain objects. Drops `undefined` array entries.
 */
export function stripUndefined<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as T;
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (nested === undefined) continue;
    result[key] = stripUndefined(nested);
  }
  return result as T;
}

/** Collect dotted paths whose value is `undefined` (for diagnostics). */
export function findUndefinedPaths(
  value: unknown,
  path = "",
): string[] {
  if (value === undefined) {
    return [path || "(root)"];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findUndefinedPaths(item, path ? `${path}[${index}]` : `[${index}]`),
    );
  }
  if (!isPlainObject(value)) {
    return [];
  }
  return Object.entries(value).flatMap(([key, nested]) =>
    findUndefinedPaths(nested, path ? `${path}.${key}` : key),
  );
}

/** Parse the free-form `specification` blob into label/value pairs. */
export function parseSpecificationBlock(specification?: string) {
  if (!specification) return [];
  return specification
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator === -1) return { label: line, value: "" };
      return {
        label: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
      };
    })
    .filter((entry) => entry.value.length > 0);
}
