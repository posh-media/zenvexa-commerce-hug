import type { Product } from "./commerce";
const projectId = "zenvexa-c8d84";
function base() {
  const local = import.meta.env.DEV && import.meta.env["VITE_FIREBASE_EMULATORS"] === "true";
  return local ? "http://127.0.0.1:8080/v1" : "https://firestore.googleapis.com/v1";
}
function decode(value: Record<string, unknown>): unknown {
  if ("stringValue" in value) return value["stringValue"];
  if ("integerValue" in value) return Number(value["integerValue"]);
  if ("doubleValue" in value) return value["doubleValue"];
  if ("booleanValue" in value) return value["booleanValue"];
  if ("timestampValue" in value) return value["timestampValue"];
  if ("arrayValue" in value)
    return ((value["arrayValue"] as { values?: Record<string, unknown>[] }).values ?? []).map(
      decode,
    );
  if ("mapValue" in value)
    return Object.fromEntries(
      Object.entries(
        (value["mapValue"] as { fields: Record<string, Record<string, unknown>> }).fields ?? {},
      ).map(([k, v]) => [k, decode(v)]),
    );
  return null;
}
function product(id: string, fields: Record<string, Record<string, unknown>>): Product | null {
  const data = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
  if (
    data["active"] !== true ||
    typeof data["title"] !== "string" ||
    !Number.isSafeInteger(data["price"]) ||
    Number(data["price"]) <= 0
  )
    return null;
  return {
    id,
    title: data["title"],
    category: String(data["category"] ?? ""),
    price: Number(data["price"]),
    oldPrice: Number(data["oldPrice"] ?? data["price"]),
    stock: Number(data["stock"] ?? 0),
    image: String(data["image"] ?? "/catalog/missing.svg"),
    images: Array.isArray(data["images"])
      ? (data["images"] as string[])
      : [String(data["image"] ?? "/catalog/missing.svg")],
    description: String(data["description"] ?? ""),
    shortDescription: String(data["shortDescription"] ?? ""),
    sku: String(data["sku"] ?? ""),
    badge: String(data["badge"] ?? ""),
    vendor: String(data["vendor"] ?? ""),
    specs: Array.isArray(data["specs"]) ? (data["specs"] as string[]) : [],
    rating: Number(data["rating"] ?? 0),
    reviews: Number(data["reviews"] ?? 0),
    reviewSource: String(data["reviewSource"] ?? "unverified"),
    imageStatus: String(data["imageStatus"] ?? "unverified"),
    currency: "NGN",
    active: true,
  };
}
export async function loadProduct(id: string): Promise<Product | null> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return null;
  const response = await fetch(
    `${base()}/projects/${projectId}/databases/(default)/documents/products/${encodeURIComponent(id)}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public Firestore catalogue is unavailable.");
  const data = (await response.json()) as { fields: Record<string, Record<string, unknown>> };
  return product(id, data.fields);
}
export async function publicProductIds(): Promise<string[]> {
  const response = await fetch(
    `${base()}/projects/${projectId}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "products" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "active" },
              op: "EQUAL",
              value: { booleanValue: true },
            },
          },
          limit: 2000,
        },
      }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error("Public catalogue enumeration unavailable.");
  const rows = (await response.json()) as {
    document?: { name: string; fields: Record<string, Record<string, unknown>> };
  }[];
  const ids = rows.flatMap((r) => {
    if (!r.document) return [];
    const id = r.document.name.split("/").at(-1)!;
    return product(id, r.document.fields) ? [id] : [];
  });
  if (ids.length >= 2000) throw new Error("Sitemap exceeds reviewed enumeration limit.");
  return ids;
}
