import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { callBackend, firebaseClient } from "@/lib/firebase-client";
import { categories, money } from "@/lib/commerce";
import { useStore } from "./store-context";
import { Brand } from "./storefront";
import { ProductImage } from "./product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Row = { id: string; [key: string]: unknown };
type Page = { records: Row[]; nextCursor: string | null };
const str = (r: Row, key: string) => String(r[key] ?? "");
const num = (r: Row, key: string) => Number(r[key] ?? 0);
const readable = (v: unknown): string =>
  v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
const sections = [
  ["dashboard", "Overview", ["admin", "inventory", "orders"]],
  ["products", "Products", ["admin", "inventory"]],
  ["inventory", "Inventory", ["admin", "inventory"]],
  ["orders", "Orders", ["admin", "orders"]],
  ["payments", "Payments", ["admin"]],
  ["customers", "Customers", ["admin", "orders"]],
  ["categories", "Categories", ["admin", "inventory"]],
  ["delivery", "Delivery", ["admin"]],
  ["promotions", "Promotions", ["admin"]],
  ["staff", "Staff", ["admin"]],
  ["settings", "Settings", ["admin"]],
  ["audit", "Audit", ["admin"]],
] as const;
const columns: Record<string, string[]> = {
  products: ["title", "sku", "category", "price", "stock", "active"],
  inventory: ["title", "sku", "stock"],
  orders: ["id", "status", "paymentStatus", "paymentMethod", "total", "createdAt"],
  payments: ["reference", "orderId", "amountKobo", "currency", "provider", "status", "createdAt"],
  customers: ["id", "displayName", "phone", "orderCount"],
  categories: ["name", "description", "image", "featured"],
  delivery: ["state", "fee", "zones", "eta"],
  staff: ["id", "role", "active"],
  audit: ["action", "actor", "productId", "resourceId", "reason", "createdAt"],
  settings: ["email", "phone", "whatsapp"],
};
export function AdminWorkspace() {
  const store = useStore();
  const role = store.staffRole;
  const [section, setSection] = useState("dashboard");
  const [page, setPage] = useState<Page>({ records: [], nextCursor: null });
  const [history, setHistory] = useState<(string | null)[]>([null]);
  const [index, setIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("title");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState<Row | null>(null);
  const [detail, setDetail] = useState<{ order: Row; events: Row[] } | null>(null);
  const permitted = sections.filter((s) => (s[2] as readonly string[]).includes(role));
  const dates = useMemo(
    () => ({
      ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
    }),
    [from, to],
  );
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      if (section === "dashboard") setOverview(await callBackend("adminDashboard", dates));
      else if (section !== "promotions")
        setPage(
          await callBackend<Page>("adminRead", {
            section: section === "inventory" ? "products" : section,
            limit: 25,
            ...(history[index] ? { cursor: history[index] } : {}),
            ...(["orders", "products", "inventory"].includes(section)
              ? { ...(section === "orders" ? dates : {}), ...(status ? { status } : {}) }
              : {}),
            ...(section === "products" && serverSearch ? { search: serverSearch } : {}),
          }),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Administration data could not be loaded.");
      setPage({ records: [], nextCursor: null });
    } finally {
      setBusy(false);
    }
  }, [section, dates, history, index, status, serverSearch]);
  useEffect(() => {
    void load();
  }, [load]);
  function navigate(next: string) {
    setSection(next);
    setSelected(null);
    setDetail(null);
    setSearch("");
    setServerSearch("");
    setStatus("");
    setHistory([null]);
    setIndex(0);
  }
  async function mutation(name: string, data: unknown) {
    setBusy(true);
    setError("");
    try {
      await callBackend(name, data);
      toast.success("Saved to Firebase");
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The change could not be saved.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function inspect(orderId: string) {
    setBusy(true);
    try {
      setDetail(await callBackend("adminOrderDetail", { orderId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order unavailable.");
    } finally {
      setBusy(false);
    }
  }
  const visible = [...page.records]
    .filter(
      (r) =>
        section === "products" ||
        !search ||
        JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "stock"
        ? num(a, "stock") - num(b, "stock")
        : sort === "price"
          ? num(a, "price") - num(b, "price")
          : str(a, sort).localeCompare(str(b, sort)),
    );
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="container-page admin-header-inner">
          <Brand />
          <span className="admin-pill">{role} operations</span>
          <Button asChild variant="outline">
            <Link to="/">Storefront</Link>
          </Button>
          <Button onClick={() => void signOut(firebaseClient().auth)}>Sign out</Button>
        </div>
      </header>
      <main className="container-page view-page">
        <h1 className="page-title">Zenvexa administration</h1>
        <nav aria-label="Admin sections" className="flex flex-wrap gap-2 mb-6">
          {permitted.map(([key, label]) => (
            <Button
              key={key}
              variant={section === key ? "default" : "outline"}
              aria-pressed={section === key}
              onClick={() => navigate(key)}
            >
              {label}
            </Button>
          ))}
        </nav>
        {error && (
          <div role="alert" className="demo-notice">
            {error}
            <Button variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}
        {busy && <p role="status">Working with Firebase…</p>}
        {["dashboard", "orders"].includes(section) && (
          <div className="form-grid view-section">
            <label className="field">
              From
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setIndex(0);
                  setHistory([null]);
                }}
              />
            </label>
            <label className="field">
              Through
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setIndex(0);
                  setHistory([null]);
                }}
              />
            </label>
          </div>
        )}
        {section === "dashboard" ? (
          <>
            <h2>Overview</h2>
            <p>{String(overview["revenueBasis"] ?? "Product inventory summary")}</p>
            <div className="kpi-grid">
              {Object.entries(overview)
                .filter(([, v]) => typeof v === "number")
                .map(([key, value]) => (
                  <div className="kpi-card" key={key}>
                    <div>
                      <small>{key.replace(/([A-Z])/g, " $1")}</small>
                      <strong>{key === "revenue" ? money(Number(value)) : String(value)}</strong>
                    </div>
                  </div>
                ))}
            </div>
            {Boolean(overview["statuses"]) && (
              <pre>{JSON.stringify(overview["statuses"], null, 2)}</pre>
            )}
            <h3>Recent orders</h3>
            <pre className="overflow-auto">
              {JSON.stringify(overview["recentOrders"] ?? [], null, 2)}
            </pre>
          </>
        ) : section === "promotions" ? (
          <section className="view-section">
            <h2>Promotions</h2>
            <p>
              Server-enforced rules: HUG10 gives 10% off merchandise, rounded to whole naira.
              NAIJA5K gives ₦5,000 off merchandise strictly above ₦50,000. Delivery is excluded.
            </p>
            <p>
              These established codes are read-only here. Additional promotions or eligibility
              changes require a reviewed backend change.
            </p>
          </section>
        ) : (
          <>
            <h2 className="page-title">{sections.find((s) => s[0] === section)?.[1]}</h2>
            {section === "products" && (
              <Button disabled={busy} onClick={() => setSelected({ id: crypto.randomUUID() })}>
                Add product
              </Button>
            )}
            {section === "staff" && (
              <p>
                Assignments are read-only. A trusted project administrator must bootstrap/revoke
                roles; no public or self-service role grants are exposed.
              </p>
            )}
            {section === "payments" && (
              <p>
                Read-only provider records. Amounts below are kobo (100 kobo = ₦1). No browser
                action can mark an electronic payment verified. Gateway activation and
                reconciliation tooling require separate review.
              </p>
            )}
            {section === "settings" && (
              <Button onClick={() => setSelected(page.records[0] ?? { id: "contact" })}>
                Edit public contact details
              </Button>
            )}
            <div className="form-grid view-section">
              <label className="field">
                {section === "products"
                  ? "Search catalogue by word prefix or exact SKU/ID"
                  : "Filter loaded page"}
                <Input value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <div className="flex gap-2 items-end">
                {section === "products" && (
                  <Button
                    onClick={() => {
                      setServerSearch(search.trim().toLowerCase());
                      setHistory([null]);
                      setIndex(0);
                    }}
                  >
                    Search
                  </Button>
                )}
                <label className="field">
                  Sort this page
                  <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="title">Title</option>
                    <option value="stock">Stock ascending</option>
                    <option value="price">Price ascending</option>
                    <option value="createdAt">Date ascending</option>
                  </select>
                </label>
              </div>
              {["products", "inventory"].includes(section) && (
                <label className="field">
                  Catalogue status
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setIndex(0);
                      setHistory([null]);
                    }}
                  >
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="out">Out of stock</option>
                    <option value="low">Low stock</option>
                  </select>
                </label>
              )}
              {section === "orders" && (
                <>
                  <label className="field">
                    Fulfilment status
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setHistory([null]);
                        setIndex(0);
                      }}
                    >
                      <option value="">All</option>
                      {[
                        "pending_payment",
                        "processing",
                        "dispatched",
                        "delivered",
                        "cancelled",
                        "refunded",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <Button
                    onClick={() => void inspect(search.trim())}
                    disabled={!search.trim() || busy}
                  >
                    Open exact order ID
                  </Button>
                </>
              )}
            </div>
            {!busy && !visible.length && <p>No matching records on this page.</p>}
            <div className="inventory-wrap admin-scroll">
              <table className="inventory-table">
                <thead>
                  <tr>
                    {(columns[section] ?? []).map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      {(columns[section] ?? []).map((c) => (
                        <td key={c} className="max-w-64 break-words">
                          {["price", "total", "fee"].includes(c)
                            ? money(num(r, c))
                            : readable(r[c])}
                        </td>
                      ))}
                      <td>
                        {["products", "inventory", "categories", "delivery"].includes(section) && (
                          <Button variant="outline" disabled={busy} onClick={() => setSelected(r)}>
                            {section === "inventory" ? "Adjust" : "Edit"}
                          </Button>
                        )}
                        {section === "orders" && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => void inspect(r.id)}
                          >
                            Inspect
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 my-4">
              <Button disabled={busy || index === 0} onClick={() => setIndex((i) => i - 1)}>
                Previous
              </Button>
              <span>
                Page {index + 1} · {page.records.length} records · server limit 25
              </span>
              <Button
                disabled={busy || !page.nextCursor}
                onClick={() => {
                  setHistory((h) => [...h.slice(0, index + 1), page.nextCursor]);
                  setIndex((i) => i + 1);
                }}
              >
                Next
              </Button>
              <Button variant="outline" onClick={() => void load()}>
                Refresh
              </Button>
            </div>
            {selected && (
              <section className="view-section">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close editor
                </Button>
                {section === "products" ? (
                  <ProductEditor
                    key={selected.id}
                    record={selected}
                    busy={busy}
                    onSave={(data) => mutation("saveProduct", data)}
                  />
                ) : section === "inventory" ? (
                  <InventoryEditor
                    record={selected}
                    busy={busy}
                    onSave={(data) => mutation("adjustInventory", data)}
                  />
                ) : (
                  <ConfigurationEditor
                    key={selected.id}
                    section={section}
                    record={selected}
                    busy={busy}
                    onSave={(data) => mutation("saveConfiguration", data)}
                  />
                )}
              </section>
            )}
            {detail && section === "orders" && (
              <OrderInspector
                detail={detail}
                role={role}
                busy={busy}
                onAction={async (name, data) => {
                  await mutation(name, data);
                  await inspect(detail.order.id);
                }}
                onClose={() => setDetail(null)}
              />
            )}
          </>
        )}
        <section className="view-section mt-8">
          <h2>Operational boundaries</h2>
          <p>
            This is one centrally managed store. Gateway secrets and live payment switches are not
            editable here. Refund issuance, staff grants, advertising ledgers, banner campaigns and
            notification delivery are not exposed as placeholder success actions. Verified refunds
            and recorded POD collection remain separate from revenue for unpaid orders.
          </p>
        </section>
      </main>
    </div>
  );
}
const emptyProduct = {
  title: "",
  slug: "",
  sku: "",
  category: categories[1] as string,
  price: "",
  oldPrice: "",
  stock: "0",
  vendor: "Zenvexa",
  badge: "",
  description: "",
  shortDescription: "",
  specs: "",
  images: "/catalog/missing.svg",
  featured: false,
  active: true,
};
function ProductEditor({
  record,
  busy,
  onSave,
}: {
  record: Row;
  busy: boolean;
  onSave: (data: unknown) => Promise<void>;
}) {
  const existing = typeof record["title"] === "string";
  const [f, setF] = useState(() => ({
    ...emptyProduct,
    ...Object.fromEntries(
      [
        "title",
        "slug",
        "sku",
        "category",
        "price",
        "oldPrice",
        "stock",
        "vendor",
        "badge",
        "description",
        "shortDescription",
      ]
        .filter((k) => record[k] !== undefined)
        .map((k) => [k, String(record[k])]),
    ),
    specs: Array.isArray(record["specs"]) ? record["specs"].join("\n") : "",
    images: Array.isArray(record["images"])
      ? record["images"].join("\n")
      : str(record, "image") || emptyProduct.images,
    featured: record["featured"] === true,
    active: record["active"] !== false,
  }));
  const [reason, setReason] = useState("");
  const [uploading, setUploading] = useState(false);
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 700000)
        throw new Error("Use JPEG/PNG/WebP below 700 KB.");
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const target = ref(firebaseClient().storage, `products/${record.id}/${hash}`);
      let url;
      try {
        url = await getDownloadURL(target);
      } catch (e) {
        if ((e as { code?: string }).code !== "storage/object-not-found") throw e;
        await uploadBytes(target, file, { contentType: file.type });
        url = await getDownloadURL(target);
      }
      setF((p) => ({
        ...p,
        images: `${p.images === "/catalog/missing.svg" ? "" : p.images}\n${url}`.trim(),
      }));
      toast.success("Image ready. Order gallery URLs to select the primary image.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const images = f.images
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!images.length) images.push("/catalog/missing.svg");
    const product = {
      id: record.id,
      title: f.title,
      slug: f.slug || record.id,
      sku: f.sku,
      category: f.category,
      price: Number(f.price),
      oldPrice: Number(f.oldPrice || f.price),
      stock: Number(f.stock),
      vendor: f.vendor,
      badge: f.badge,
      description: f.description,
      shortDescription: f.shortDescription,
      specs: f.specs
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      image: images[0],
      images,
      featured: f.featured,
      active: f.active,
      currency: "NGN",
      imageStatus: str(record, "imageStatus") || "unverified",
      imageNotes: str(record, "imageNotes"),
    };
    try {
      await onSave({
        product,
        expectedStock: existing ? num(record, "stock") : null,
        expectedVersion: num(record, "version"),
        reason: reason || "catalogue edit",
      });
    } catch {
      return;
    }
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="form-grid mt-5">
      <h3 className="field full">
        {existing ? "Edit" : "Create"} product · {record.id}
      </h3>
      {(
        [
          "title",
          "slug",
          "sku",
          "price",
          "oldPrice",
          "stock",
          "vendor",
          "badge",
          "shortDescription",
        ] as const
      ).map((key) => (
        <label className="field" key={key}>
          {key}
          <Input
            required={["title", "sku", "price", "stock", "vendor"].includes(key)}
            type={["price", "oldPrice", "stock"].includes(key) ? "number" : "text"}
            min={key === "stock" ? 0 : 1}
            step={1}
            value={f[key]}
            onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}
          />
        </label>
      ))}
      <label className="field">
        Category
        <select
          value={f.category}
          onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))}
        >
          {categories.slice(1).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {(["description", "specs", "images"] as const).map((key) => (
        <label className="field full" key={key}>
          {key}
          {key === "images"
            ? " (one URL per line; first is primary)"
            : key === "specs"
              ? " (one per line)"
              : ""}
          <textarea
            required={key === "description"}
            value={f[key]}
            onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))}
          />
        </label>
      ))}
      <label className="field">
        Upload gallery image
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      <ProductImage
        src={f.images.split("\n")[0]}
        alt="Primary product preview"
        className="admin-preview"
      />
      {(["featured", "active"] as const).map((key) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={f[key]}
            onChange={(e) => setF((p) => ({ ...p, [key]: e.target.checked }))}
          />{" "}
          {key}
        </label>
      ))}
      <label className="field full">
        Adjustment/edit reason
        <Input value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <Button disabled={busy || uploading} type="submit">
        Save product to Firebase
      </Button>
      <p>
        Ratings/review counts are not fabricated by this form. Deactivate instead of deleting
        products referenced by orders.
      </p>
    </form>
  );
}
function InventoryEditor({
  record,
  busy,
  onSave,
}: {
  record: Row;
  busy: boolean;
  onSave: (data: unknown) => Promise<void>;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  return (
    <form
      className="form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          productId: record.id,
          expectedStock: num(record, "stock"),
          delta: Number(delta),
          reason,
        }).catch(() => {});
      }}
    >
      <h3>
        Adjust {str(record, "title")} · available {num(record, "stock")}
      </h3>
      <label className="field">
        Signed adjustment
        <Input
          required
          type="number"
          step={1}
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
        />
      </label>
      <label className="field">
        Reason
        <Input required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <Button disabled={busy}>Record stock adjustment</Button>
      <p>
        Stock already reserved by orders is not available stock. A concurrent change rejects this
        adjustment.
      </p>
    </form>
  );
}
function ConfigurationEditor({
  section,
  record,
  busy,
  onSave,
}: {
  section: string;
  record: Row;
  busy: boolean;
  onSave: (data: unknown) => Promise<void>;
}) {
  const keys =
    section === "categories"
      ? ["name", "description", "image", "featured"]
      : section === "delivery"
        ? ["state", "fee", "zones", "eta", "reason"]
        : ["email", "phone", "whatsapp"];
  const [data, setData] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      keys.map((k) => [
        k,
        Array.isArray(record[k]) ? (record[k] as string[]).join("\n") : str(record, k),
      ]),
    ),
  );
  return (
    <form
      className="form-grid mt-5"
      onSubmit={(e) => {
        e.preventDefault();
        const result: Record<string, unknown> = { ...data };
        if (section === "categories") result["featured"] = data["featured"] === "true";
        if (section === "delivery") {
          result["fee"] = Number(data["fee"]);
          result["zones"] = String(data["zones"])
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        void onSave({ section, record: result }).catch(() => {});
      }}
    >
      {keys.map((key) => (
        <label className="field" key={key}>
          {key}
          {["zones", "description"].includes(key) ? (
            <textarea
              value={data[key]}
              onChange={(e) => setData((p) => ({ ...p, [key]: e.target.value }))}
            />
          ) : (
            <Input
              readOnly={["name", "state", "eta"].includes(key)}
              required={key === "reason"}
              minLength={key === "reason" ? 5 : undefined}
              type={key === "fee" ? "number" : "text"}
              min={0}
              value={data[key]}
              onChange={(e) => setData((p) => ({ ...p, [key]: e.target.value }))}
            />
          )}
        </label>
      ))}
      <Button disabled={busy}>Save configuration</Button>
      <p>Canonical category identities and the established ETA cannot be renamed/deleted here.</p>
    </form>
  );
}
function OrderInspector({
  detail,
  role,
  busy,
  onAction,
  onClose,
}: {
  detail: { order: Row; events: Row[] };
  role: string;
  busy: boolean;
  onAction: (name: string, data: unknown) => Promise<void>;
  onClose: () => void;
}) {
  const o = detail.order;
  const [receipt, setReceipt] = useState("");
  const status = str(o, "status");
  const next = status === "processing" ? "dispatched" : status === "dispatched" ? "delivered" : "";
  return (
    <section className="view-section">
      <h2>Order {o.id}</h2>
      <Button variant="outline" onClick={onClose}>
        Close order
      </Button>
      <p>
        Fulfilment: {status} · Payment: {str(o, "paymentMethod")} / {str(o, "paymentStatus")}
      </p>
      <h3>Recipient and delivery</h3>
      <pre className="overflow-auto">{JSON.stringify(o["delivery"], null, 2)}</pre>
      <h3>Items and server quote</h3>
      <pre className="overflow-auto">{JSON.stringify(o["items"], null, 2)}</pre>
      <p>
        Subtotal {money(num(o, "subtotal"))} · Discount {money(num(o, "discount"))} · Delivery{" "}
        {money(num(o, "deliveryFee"))} · Total {money(num(o, "total"))}
      </p>
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button
            disabled={busy}
            onClick={() =>
              void onAction("updateOrderStatus", { orderId: o.id, status: next }).catch(() => {})
            }
          >
            {next}
          </Button>
        )}
        {["pending_payment", "processing"].includes(status) && (
          <Button
            disabled={
              busy ||
              !!o["paymentReference"] ||
              ["paid", "collected"].includes(str(o, "paymentStatus"))
            }
            onClick={() =>
              void onAction("updateOrderStatus", { orderId: o.id, status: "cancelled" }).catch(
                () => {},
              )
            }
          >
            Cancel eligible unpaid order
          </Button>
        )}
        {role === "admin" &&
          str(o, "paymentMethod") === "pod" &&
          status === "delivered" &&
          str(o, "paymentStatus") === "uncollected" && (
            <>
              <Input
                aria-label="POD collection receipt"
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
              />
              <Button
                disabled={busy || !receipt.trim()}
                onClick={() =>
                  void onAction("collectPod", { orderId: o.id, receipt }).catch(() => {})
                }
              >
                Record POD collection
              </Button>
            </>
          )}
      </div>
      <h3>Recorded history</h3>
      {detail.events.map((e) => (
        <p key={e.id}>
          {str(e, "createdAt")} · {str(e, "type")} · {str(e, "actor")}
        </p>
      ))}
      <p>
        Electronic payment verification cannot be overridden here. Attempted-payment cancellations
        and refunds require provider reconciliation.
      </p>
    </section>
  );
}
