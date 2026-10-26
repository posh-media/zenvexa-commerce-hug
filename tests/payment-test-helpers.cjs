const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");

// Run the actual TypeScript modules with mocked network/database boundaries.
function loader(overrides = {}) {
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (!name.startsWith("@/")) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const file = path.join(__dirname, "../src", name.slice(2) + ".ts");
    const module = { exports: {} };
    cache.set(name, module);
    const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    new Function("require", "module", "exports", output)(
      load,
      module,
      module.exports,
    );
    return module.exports;
  }
  return load;
}

function database(initial) {
  const records = new Map(
    Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]),
  );
  let next = 0;
  const snap = (ref) => ({
    id: ref.id,
    ref,
    exists: records.has(ref.path),
    data: () => records.get(ref.path),
  });
  const ref = (collection, id) => ({
    id,
    path: `${collection}/${id}`,
    get: async function () {
      return snap(this);
    },
    update: async function (patch) {
      records.set(this.path, { ...records.get(this.path), ...patch });
    },
  });
  function query(collection, filters = [], count = Infinity) {
    return {
      doc: (id) => ref(collection, id || `payment-${++next}`),
      where: (field, op, value) =>
        query(collection, [...filters, [field, value]], count),
      limit: (n) => query(collection, filters, n),
      get: async () => {
        const docs = [...records]
          .filter(
            ([k, v]) =>
              k.startsWith(`${collection}/`) &&
              filters.every(([field, value]) => v[field] === value),
          )
          .slice(0, count)
          .map(([key]) => snap(ref(collection, key.split("/")[1])));
        return { docs, empty: docs.length === 0 };
      },
    };
  }
  const db = {
    collection: query,
    runTransaction: async (fn) => {
      const writes = [];
      const result = await fn({
        get: async (r) => {
          assert.equal(writes.length, 0, "Firestore reads must precede writes");
          return snap(r);
        },
        set: (r, value, options) =>
          writes.push(() =>
            records.set(
              r.path,
              options?.merge ? { ...records.get(r.path), ...value } : value,
            ),
          ),
        update: (r, value) =>
          writes.push(() =>
            records.set(r.path, { ...records.get(r.path), ...value }),
          ),
      });
      writes.forEach((write) => write());
      return result;
    },
  };
  return { db, records };
}

async function withFetch(mock, fn) {
  const original = global.fetch;
  global.fetch = mock;
  try {
    return await fn();
  } finally {
    global.fetch = original;
  }
}

module.exports = { loader, database, withFetch };
