import { CURRENCY } from "@/constants/app";
import type { FirestoreDate } from "@/types/firestore";
import { toDate } from "./firestore";

export function formatDate(
  value: FirestoreDate | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(CURRENCY.locale, options).format(date);
}

export function formatDateTime(value: FirestoreDate | undefined) {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" });
}

export function formatRelativeTime(value: FirestoreDate | undefined) {
  const date = toDate(value);
  if (!date) return "";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(CURRENCY.locale, {
    numeric: "auto",
  });
  for (const [unit, unitSeconds] of units) {
    if (Math.abs(seconds) >= unitSeconds) {
      return formatter.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return formatter.format(seconds, "second");
}
