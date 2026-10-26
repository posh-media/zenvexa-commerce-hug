/**
 * Recursively remove `undefined` before Firestore Admin writes.
 * Preserves Date, FieldValue, DocumentReference, and other class instances.
 */
function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function stripUndefined(value) {
  if (value === undefined) return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item));
  }
  if (!isPlainObject(value)) return value;
  const result = {};
  for (const [key, nested] of Object.entries(value)) {
    if (nested === undefined) continue;
    result[key] = stripUndefined(nested);
  }
  return result;
}

module.exports = { stripUndefined };
