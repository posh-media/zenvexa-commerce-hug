/** Stable store identity. Display names and order prefixes are never identifiers. */
export const STORE_IDS = ["shopbeta", "zenvexa"] as const;
export type StoreId = (typeof STORE_IDS)[number];
export const STORE_SETTINGS = {
  shopbeta: "ShopBeta",
  zenvexa: "Zenvexa",
} as const;
export const STORE_NAME_ERROR =
  "Admin has not configured the store name. Please contact support.";
export function parseStoreId(value: unknown): StoreId {
  if (value === "shopbeta" || value === "zenvexa") return value;
  throw new Error("Unknown store identity.");
}
export function deploymentStoreId(): StoreId {
  const client = process.env.NEXT_PUBLIC_STORE_ID || "zenvexa";
  const server =
    typeof window === "undefined" ? process.env.STORE_ID : undefined;
  if (server && server !== client)
    throw new Error("STORE_ID and NEXT_PUBLIC_STORE_ID disagree.");
  return parseStoreId(server || client);
}
export function settingsDocumentId(id: StoreId = deploymentStoreId()): string {
  return id === "shopbeta" &&
    process.env.NEXT_PUBLIC_SHOPBETA_SETTINGS_CUTOVER !== "true"
    ? "app"
    : STORE_SETTINGS[id];
}
export type Attribution = {
  storeId?: unknown;
  storeName?: unknown;
  store?: unknown;
};
/** Fail closed for unknown/conflicting nonempty attribution; only genuinely blank legacy data is ShopBeta. */
export function recordStoreId(record: Attribution): StoreId | null {
  const raw =
    typeof record.storeId === "string" ? record.storeId.trim() : record.storeId;
  const names = [record.storeName, record.store].filter(
    (v) => v != null && String(v).trim(),
  );
  if (raw != null && raw !== "")
    return raw === "shopbeta" || raw === "zenvexa" ? raw : null;
  if (!names.length) return "shopbeta";
  const ids = names.map((v) =>
    String(v).trim().replace(/\s+/g, "").toLowerCase(),
  );
  if (ids.every((v) => v === "shopbeta")) return "shopbeta";
  if (ids.every((v) => v === "zenvexa")) return "zenvexa";
  return null;
}
export function belongsToStore(record: Attribution, id = deploymentStoreId()) {
  return recordStoreId(record) === id;
}
export function requireStoreName(
  settings:
    { storeId?: string; storeInformation?: { name?: string } } | undefined,
  id = deploymentStoreId(),
) {
  if (settings?.storeId && settings.storeId !== id)
    throw new Error("Store settings identity mismatch.");
  const name = settings?.storeInformation?.name?.trim();
  if (!name || !/[\p{L}\p{N}]/u.test(name)) throw new Error(STORE_NAME_ERROR);
  return name;
}
export function orderPrefix(name: string) {
  const words = name.trim().match(/[\p{L}\p{N}]+/gu) || [];
  if (!words.length) throw new Error(STORE_NAME_ERROR);
  if (words.length > 1)
    return (Array.from(words[0]!)[0] + Array.from(words[1]!)[0]).toUpperCase();
  const parts =
    words[0]!.match(
      /[\p{Lu}]+(?=[\p{Lu}][\p{Ll}]|[0-9]|$)|[\p{Lu}]?[\p{Ll}]+|[0-9]+|[^\x00-\x7F]+/gu,
    ) || words;
  return (
    parts.length > 1
      ? Array.from(parts[0]!)[0] + Array.from(parts[1]!)[0]
      : Array.from(words[0]!).slice(0, 3).join("")
  ).toUpperCase();
}
export function scopedCounterId(key: string, id = deploymentStoreId()) {
  return `${id}__${key}`;
}

export function hasStoreAttribution(record: Attribution) {
  return [record.storeId, record.storeName, record.store].some(
    (value) => value != null && (typeof value !== "string" || !!value.trim()),
  );
}

export function providerDocumentSegments(
  provider: string,
  id = deploymentStoreId(),
): string[] {
  return id === "shopbeta" && settingsDocumentId(id) === "app"
    ? ["privatePaymentSettings", provider]
    : ["privatePaymentSettings", id, "providers", provider];
}
