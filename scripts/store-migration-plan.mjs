export const CUTOFF = Date.parse("2026-10-28T00:00:00Z");
const blank = (value) =>
  value == null || (typeof value === "string" && !value.trim());
export function attribution(data) {
  const id =
    typeof data.storeId === "string" ? data.storeId.trim() : data.storeId;
  if (!blank(id)) return ["shopbeta", "zenvexa"].includes(id) ? id : "unknown";
  const values = [data.storeName, data.store]
    .filter((v) => !blank(v))
    .map((v) => String(v).trim().replace(/\s+/g, "").toLowerCase());
  if (!values.length) return "unlabelled";
  if (values.every((v) => v === "shopbeta")) return "shopbeta";
  if (values.every((v) => v === "zenvexa")) return "zenvexa";
  return "unknown";
}
export function toMillis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds != null)
    return Number(value.seconds) * 1000 + Number(value.nanoseconds || 0) / 1e6;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number")
    return new Date(value).getTime();
  return NaN;
}
export function orderPatch(data) {
  const store = attribution(data);
  if (store === "unknown") return { reason: "ambiguous" };
  if (store === "shopbeta" || store === "zenvexa") {
    if (data.storeId === store) return { reason: "explicit" };
    // Preserve an explicit historical name when adding the permanent ID.
    return {
      patch: {
        storeId: store,
        storeName:
          typeof data.storeName === "string" && data.storeName.trim()
            ? data.storeName.trim()
            : store === "shopbeta"
              ? "ShopBeta"
              : "Zenvexa",
      },
    };
  }
  const created = toMillis(data.createdAt);
  if (!Number.isFinite(created)) return { reason: "ambiguous-date" };
  if (created >= CUTOFF) return { reason: "after-cutoff" };
  return { patch: { storeId: "shopbeta", storeName: "ShopBeta" } };
}
export function publicSettings(data, storeId, name) {
  const { paymentSecrets: _secrets, id: _id, storeName: _name, ...copy } = data;
  void _secrets;
  void _id;
  void _name;
  if (copy.notifications) {
    const {
      makeWebhookUrl: _make,
      transactionalEmailWebhookUrl: _email,
      ...flags
    } = copy.notifications;
    void _make;
    void _email;
    copy.notifications = flags;
  }
  return {
    ...copy,
    storeId,
    storeInformation: { ...copy.storeInformation, name },
  };
}
