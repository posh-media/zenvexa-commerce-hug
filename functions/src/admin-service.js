import { AggregateField, FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  categoryNames,
  deliveryDefaults,
  deliveryId,
  id,
  integer,
  object,
  requireValue,
  text,
} from "./core.js";

const permissions = {
  products: ["admin", "inventory"],
  inventoryEvents: ["admin", "inventory"],
  orders: ["admin", "orders"],
  payments: ["admin"],
  customers: ["admin", "orders"],
  categories: ["admin", "inventory"],
  delivery: ["admin"],
  staff: ["admin"],
  audit: ["admin"],
  settings: ["admin"],
};
const collections = {
  products: "products",
  inventoryEvents: "inventoryEvents",
  orders: "orders",
  payments: "paymentAttempts",
  customers: "profiles",
  categories: "categories",
  delivery: "deliveryZones",
  staff: "staff",
  audit: "auditLogs",
  settings: "storeSettings",
};
const fields = {
  payments: ["reference", "orderId", "amountKobo", "currency", "status", "createdAt", "updatedAt"],
  customers: ["displayName", "phone"],
  staff: ["role", "active", "updatedAt"],
  audit: ["action", "actor", "productId", "resourceId", "reason", "createdAt"],
};
export function plain(value) {
  if (value?.toDate instanceof Function) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, plain(v)]));
  return value;
}
export function adminService(db) {
  async function authorize(uid, roles, reader = db) {
    const ref = db.doc(`staff/${id(uid)}`);
    const record = reader === db ? await ref.get() : await reader.get(ref);
    requireValue(
      record.exists && record.data().active === true && roles.includes(record.data().role),
      "Staff permission required.",
      "permission-denied",
    );
    return record.data().role;
  }
  async function read(uid, raw) {
    object(raw, ["section", "cursor", "limit", "status", "from", "to", "search"]);
    const section = text(raw.section, 30);
    requireValue(Object.hasOwn(permissions, section), "Unknown administration section.");
    await authorize(uid, permissions[section]);
    let q = db.collection(collections[section]);
    const size = integer(raw.limit ?? 25, 1, 50);
    if (section === "products" && raw.status) {
      requireValue(
        ["active", "inactive", "out", "low"].includes(raw.status),
        "Invalid catalogue filter.",
      );
      if (["active", "inactive"].includes(raw.status))
        q = q.where("active", "==", raw.status === "active");
      else if (raw.status === "out") q = q.where("stock", "==", 0);
      else q = q.where("stock", ">", 0).where("stock", "<=", 15).orderBy("stock");
    }
    if (section === "orders" && raw.status) {
      requireValue(
        [
          "pending_payment",
          "processing",
          "dispatched",
          "delivered",
          "cancelled",
          "refunded",
        ].includes(raw.status),
        "Invalid order filter.",
      );
      q = q.where("status", "==", raw.status);
    }
    if (section === "orders") {
      for (const [key, op] of [
        ["from", ">="],
        ["to", "<="],
      ])
        if (raw[key]) {
          const time = Date.parse(text(raw[key], 40));
          requireValue(Number.isFinite(time), "Invalid date.");
          q = q.where("createdAt", op, Timestamp.fromMillis(time));
        }
      q = q.orderBy("createdAt", "desc");
    }
    if (raw.search) {
      const term = text(raw.search, 200).toLowerCase();
      requireValue(section === "products", "Search this section using the visible page filters.");
      q = q.where("searchTokens", "array-contains", term);
    }
    if (section !== "orders") q = q.orderBy(FieldPath.documentId());
    if (raw.cursor) {
      const cursor = await db.doc(`${collections[section]}/${id(raw.cursor)}`).get();
      requireValue(cursor.exists, "Page cursor expired. Reload the first page.");
      q = q.startAfter(cursor);
    }
    const snapshot = await q.limit(size + 1).get();
    const docs = snapshot.docs.slice(0, size);
    const records = await Promise.all(
      docs.map(async (record) => {
        const data = record.data();
        const projected = fields[section]
          ? Object.fromEntries(
              fields[section]
                .filter((key) => data[key] !== undefined)
                .map((key) => [key, data[key]]),
            )
          : data;
        if (section === "customers") {
          const orders = await db
            .collection("orders")
            .where("userId", "==", record.id)
            .count()
            .get();
          projected.orderCount = orders.data().count;
        }
        return {
          ...plain(projected),
          id: record.id,
          ...(section === "payments" ? { provider: "paystack" } : {}),
        };
      }),
    );
    return { records, nextCursor: snapshot.size > size ? docs.at(-1).id : null };
  }
  async function dashboard(uid, raw = {}) {
    object(raw, ["from", "to"]);
    const role = await authorize(uid, ["admin", "inventory", "orders"]);
    const result = {};
    const count = async (query) => (await query.count().get()).data().count;
    if (["admin", "inventory"].includes(role)) {
      const p = db.collection("products");
      const [total, active, out, low] = await Promise.all([
        count(p),
        count(p.where("active", "==", true)),
        count(p.where("stock", "==", 0)),
        count(p.where("stock", ">", 0).where("stock", "<=", 15)),
      ]);
      Object.assign(result, {
        products: total,
        activeProducts: active,
        inactiveProducts: total - active,
        outOfStock: out,
        lowStock: low,
      });
    }
    if (["admin", "orders"].includes(role)) {
      let q = db.collection("orders");
      for (const [key, op] of [
        ["from", ">="],
        ["to", "<="],
      ])
        if (raw[key]) {
          const time = Date.parse(text(raw[key], 40));
          requireValue(Number.isFinite(time), "Invalid date.");
          q = q.where("createdAt", op, Timestamp.fromMillis(time));
        }
      result.orders = await count(q);
      result.statuses = Object.fromEntries(
        await Promise.all(
          ["pending_payment", "processing", "dispatched", "delivered", "cancelled", "refunded"].map(
            async (status) => [status, await count(q.where("status", "==", status))],
          ),
        ),
      );
      const sum = await q
        .where("isTest", "==", false)
        .where("source", "==", "checkout")
        .where("paymentStatus", "in", ["paid", "collected"])
        .aggregate({ revenue: AggregateField.sum("total") })
        .get();
      result.revenue = sum.data().revenue;
      result.revenueBasis =
        "Verified paid or recorded POD collection from non-test server checkout orders only; selected range uses order creation date. Refunds and unknown/test provenance excluded.";
      result.recentOrders = (await q.orderBy("createdAt", "desc").limit(5).get()).docs.map((d) => ({
        id: d.id,
        status: d.data().status,
        total: d.data().total,
        createdAt: plain(d.data().createdAt),
      }));
    }
    return result;
  }
  async function orderDetail(uid, raw) {
    object(raw, ["orderId"]);
    await authorize(uid, ["admin", "orders"]);
    const ref = db.doc(`orders/${id(raw.orderId)}`);
    const record = await ref.get();
    requireValue(record.exists, "Order not found.", "not-found");
    const events = await ref.collection("events").orderBy("createdAt").limit(100).get();
    return {
      order: { ...plain(record.data()), id: record.id },
      events: events.docs.map((d) => ({ id: d.id, ...plain(d.data()) })),
    };
  }
  async function adjustInventory(uid, raw) {
    object(raw, ["productId", "delta", "expectedStock", "reason"]);
    const delta = integer(raw.delta, -1000000, 1000000);
    requireValue(delta !== 0, "Adjustment must be nonzero.");
    const reason = text(raw.reason, 300, 5);
    const ref = db.doc(`products/${id(raw.productId)}`);
    await db.runTransaction(async (tx) => {
      await authorize(uid, ["admin", "inventory"], tx);
      const snap = await tx.get(ref);
      requireValue(snap.exists, "Product not found.", "not-found");
      const p = snap.data();
      requireValue(
        p.stock === integer(raw.expectedStock, 0, 1000000),
        "Inventory changed. Reload and retry.",
        "aborted",
      );
      const stock = integer(p.stock + delta, 0, 1000000);
      tx.update(ref, {
        stock,
        version: (p.version ?? 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(db.collection("inventoryEvents").doc(), {
        productId: ref.id,
        delta,
        reason,
        actor: uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(db.collection("auditLogs").doc(), {
        action: "inventory.adjust",
        productId: ref.id,
        reason,
        actor: uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true };
  }
  async function saveConfiguration(uid, raw) {
    object(raw, ["section", "record"]);
    const section = text(raw.section, 30);
    let data, ref, roles;
    if (section === "categories") {
      object(raw.record, ["name", "description", "image", "featured"]);
      const r = raw.record;
      requireValue(
        categoryNames.includes(r.name),
        "The five canonical categories cannot be renamed or deleted.",
      );
      data = {
        name: r.name,
        description: text(r.description ?? "", 500, 0),
        image: configurationImage(r.image ?? ""),
        featured: r.featured === true,
      };
      ref = db.doc(`categories/${deliveryId(r.name)}`);
      roles = ["admin", "inventory"];
    } else if (section === "delivery") {
      object(raw.record, ["state", "fee", "zones", "eta", "reason"]);
      const r = raw.record;
      requireValue(Object.hasOwn(deliveryDefaults, r.state), "Unsupported delivery state.");
      requireValue(
        Array.isArray(r.zones) && r.zones.length > 0 && r.zones.length <= 100,
        "Invalid zones.",
      );
      requireValue(
        r.eta === deliveryDefaults[r.state].eta,
        "The established delivery ETA must be preserved.",
      );
      data = {
        state: r.state,
        fee: integer(r.fee, 0, 1000000),
        zones: [...new Set(r.zones.map((z) => text(z, 80)))],
        eta: r.eta,
        active: true,
      };
      text(r.reason, 300, 5);
      ref = db.doc(`deliveryZones/${deliveryId(r.state)}`);
      roles = ["admin"];
    } else if (section === "settings") {
      object(raw.record, ["email", "phone", "whatsapp"]);
      const r = raw.record;
      const email = text(r.email ?? "", 254, 0);
      requireValue(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Invalid contact email.");
      data = { email, phone: text(r.phone ?? "", 30, 0), whatsapp: text(r.whatsapp ?? "", 30, 0) };
      ref = db.doc("storeSettings/contact");
      roles = ["admin"];
    } else throw new Error("Unsupported configuration section.");
    await db.runTransaction(async (tx) => {
      await authorize(uid, roles, tx);
      tx.set(ref, { ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.create(db.collection("auditLogs").doc(), {
        action: `${section}.save`,
        resourceId: ref.id,
        reason: raw.record.reason ?? "",
        actor: uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true };
  }
  return { read, dashboard, orderDetail, adjustInventory, saveConfiguration };
}
function configurationImage(value) {
  const image = text(value, 2048, 0);
  requireValue(
    !image || /^https:\/\//.test(image) || /^\/(?!\/)/.test(image),
    "Invalid image URL.",
  );
  return image;
}
