import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Info,
  LogOut,
  Package,
  Plus,
  ShieldAlert,
  ShoppingCart,
  Trash2,
  Wallet,
  Boxes,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseMode, firebaseClient, callBackend } from "@/lib/firebase-client";
import { AdminWorkspace } from "./admin-workspace";
import { ProductImage } from "./product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brand } from "./storefront";
import { useStore } from "./store-context";
import {
  categories,
  money,
  LOW_STOCK,
  orderSteps,
  advanceOrder,
  type Product,
} from "@/lib/commerce";

const ROLE_KEY = "zenvexa-role";
export const ADMIN_PASSCODE = "admin123";

export function AdminGate() {
  return firebaseMode ? <FirebaseAdminGate /> : <DemoAdminGate />;
}
function FirebaseAdminGate() {
  const s = useStore();
  if (s.authLoading || (s.user && s.staffLoading))
    return (
      <main className="admin-shell">
        <p role="status" className="container-page view-page">
          Checking staff access…
        </p>
      </main>
    );
  if (s.user && ["admin", "inventory", "orders"].includes(s.staffRole)) return <AdminWorkspace />;
  return <FirebaseAdminLogin user={s.user} />;
}
function authErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code))
    return "Incorrect email or password.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/user-disabled") return "This account is disabled.";
  if (code === "auth/too-many-requests") return "Too many attempts. Try again later.";
  if (code === "auth/network-request-failed") return "Check your connection and try again.";
  if (code === "auth/operation-not-allowed")
    return "Email/password sign-in is not enabled for this Firebase project.";
  return "Sign-in failed. Check the details and try again.";
}
function FirebaseAdminLogin({ user }: { user: User | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(firebaseClient().auth, email.trim(), password);
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  async function resendVerification() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await sendEmailVerification(user);
      toast.info("Verification email sent.");
    } catch {
      toast.error("Verification email could not be sent right now.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-denied">
      <div className="admin-denied-card">
        <Brand />
        <div className="denied-icon">
          <ShieldAlert />
        </div>
        <h1>
          {user ? "Access Denied — Staff Role Required" : "Access Denied — Admin Role Required"}
        </h1>
        {user ? (
          <>
            <p>
              {user.email ?? "This account"} is signed in, but the trusted staff record does not
              grant admin access.
            </p>
            {!user.isAnonymous && !user.emailVerified && (
              <small>Verify the account email before staff authorization can apply.</small>
            )}
            <div className="flex gap-2 justify-center">
              {!user.isAnonymous && !user.emailVerified && (
                <Button variant="outline" disabled={busy} onClick={() => void resendVerification()}>
                  Resend verification
                </Button>
              )}
              <Button
                variant="amber"
                disabled={busy}
                onClick={() => void signOut(firebaseClient().auth)}
              >
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>This portal is for verified Zenvexa staff. Sign in with your staff account.</p>
            <form onSubmit={(e) => void submit(e)} className="promo-form" noValidate={false}>
              <Input
                type="email"
                required
                aria-label="Email address"
                placeholder="Email address"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="password-field">
                <Input
                  type={visible ? "text" : "password"}
                  required
                  minLength={6}
                  aria-label="Password"
                  placeholder="Password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible((value) => !value)}
                >
                  {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {error && <p role="alert">{error}</p>}
              <Button type="submit" disabled={busy}>
                <Lock />
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </>
        )}
        <Link to="/" className="admin-back">
          <ArrowLeft size={13} />
          Back to storefront
        </Link>
      </div>
    </main>
  );
}
function DemoAdminGate() {
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const [code, setCode] = useState("");
  useEffect(() => {
    setRole(localStorage.getItem(ROLE_KEY));
  }, []);
  function login() {
    localStorage.setItem(ROLE_KEY, "admin");
    setRole("admin");
    toast.success("Welcome back, Admin");
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (code === ADMIN_PASSCODE) login();
    else toast.error("Incorrect admin passcode.");
  }
  function logout() {
    localStorage.removeItem(ROLE_KEY);
    setRole(null);
  }
  if (role === undefined) return <div className="admin-shell" />;
  if (role !== "admin")
    return (
      <main className="admin-denied">
        <div className="admin-denied-card">
          <Brand />
          <div className="denied-icon">
            <ShieldAlert />
          </div>
          <h1>Access Denied — Admin Role Required</h1>
          <p>This portal is for Zenvexa staff. Sign in with the admin passcode to continue.</p>
          <form onSubmit={submit} className="promo-form">
            <Input
              type="password"
              aria-label="Admin passcode"
              placeholder="Admin passcode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button type="submit">
              <Lock />
              Sign in
            </Button>
          </form>
          <Button variant="amber" className="w-full" onClick={login}>
            Demo Admin Login
          </Button>
          <small>Demo passcode: admin123 · Preview-only gate, not real security.</small>
          <Link to="/" className="admin-back">
            <ArrowLeft size={13} />
            Back to storefront
          </Link>
        </div>
      </main>
    );
  return <AdminPortal onLogout={logout} />;
}

function AdminPortal({ onLogout }: { onLogout: () => void }) {
  const s = useStore();
  const revenue = s.orders
    .filter((o) => !firebaseMode || ["paid", "collected"].includes(o.paymentStatus ?? ""))
    .reduce((n, o) => n + o.total, 0);
  const active = s.orders.filter((o) => o.step < 4).length;
  const low = s.catalog.filter((p) => p.stock <= LOW_STOCK).length;
  const kpis = [
    { label: "Total Revenue", value: money(revenue), icon: Wallet },
    { label: "Active Orders", value: String(active), icon: ShoppingCart },
    { label: "Catalog SKUs", value: String(s.catalog.length), icon: Boxes },
    { label: "Low-Stock Alerts", value: String(low), icon: AlertTriangle },
  ];
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="container-page admin-header-inner">
          <Link to="/" aria-label="Zenvexa storefront">
            <Brand />
          </Link>
          <span className="admin-pill">Admin Portal</span>
          <div className="ml-auto flex gap-2">
            <Button variant="hero" asChild>
              <Link to="/">
                <ArrowLeft />
                Storefront
              </Link>
            </Button>
            <Button variant="amber" onClick={onLogout}>
              <LogOut />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="container-page view-page">
        <div className="page-eyebrow">Zenvexa operations</div>
        <h1 className="page-title">Admin Portal</h1>
        <div className="demo-notice">
          <Info size={15} />
          {firebaseMode
            ? "Firebase operations require server-enforced staff permissions. Payment status is separate from dispatch."
            : "Changes are saved in this browser and show instantly on the storefront and Track Orders."}
        </div>
        <div className="kpi-grid">
          {kpis.map((k) => (
            <div className="kpi-card" key={k.label}>
              <div className="trust-icon">
                <k.icon />
              </div>
              <div>
                <small>{k.label}</small>
                <strong>{k.value}</strong>
              </div>
            </div>
          ))}
        </div>
        <ProductForm />
        <Inventory />
        <OrdersTable />
      </main>
    </div>
  );
}

function ProductForm() {
  const s = useStore();
  const empty = {
    title: "",
    category: categories[1] as string,
    price: "",
    oldPrice: "",
    badge: "New Arrival",
    vendor: "",
    stock: "",
    image: "",
    specs: "",
    description: "",
  };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 700_000) {
      toast.error("Please use an image under 700KB, or paste an image URL.");
      return;
    }
    if (firebaseMode) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error("Use JPEG, PNG or WebP.");
        return;
      }
      try {
        const target = ref(firebaseClient().storage, `products/uploads/${crypto.randomUUID()}`);
        await uploadBytes(target, file, { contentType: file.type });
        const image = await getDownloadURL(target);
        setF((prev) => ({ ...prev, image }));
        toast.success("Image uploaded");
      } catch {
        toast.error(
          "Image upload denied or unavailable. Check staff access and Storage configuration.",
        );
      }
      return;
    }
    const r = new FileReader();
    r.onload = () => setF((prev) => ({ ...prev, image: String(r.result) }));
    r.readAsDataURL(file);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const price = Number(f.price),
      old = Number(f.oldPrice) || price,
      stock = Number(f.stock);
    const fallback = "/catalog/missing.svg";
    if (
      !f.title.trim() ||
      !f.vendor.trim() ||
      !f.description.trim() ||
      price <= 0 ||
      stock < 0 ||
      old < price
    ) {
      toast.error(
        "Check the fields: price must be above ₦0 and old price can’t be lower than price.",
      );
      return;
    }
    const p: Product = {
      id: `adm-${Date.now()}`,
      title: f.title.trim(),
      category: f.category,
      price,
      oldPrice: old,
      badge: f.badge.trim() || "New Arrival",
      vendor: f.vendor.trim(),
      stock,
      description: f.description.trim(),
      specs: f.specs
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
      image: f.image.trim() || fallback,
      sku: `ZVX-ADM-${String(s.catalog.length + 1).padStart(3, "0")}`,
      rating: 5,
      reviews: 0,
    };
    if (firebaseMode) {
      try {
        await callBackend("saveProduct", { product: p, expectedStock: null });
        setF(empty);
        toast.success("Product saved to Firebase");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Product save failed.");
      }
      return;
    }
    s.setCatalog((prev) => [p, ...prev]);
    setF(empty);
    toast.success("Product published", { description: p.title });
  }
  return (
    <section className="view-section">
      <h2>
        <Plus size={18} className="text-primary" />
        Upload a New Product
      </h2>
      <form onSubmit={submit}>
        <div className="form-grid admin-form-grid">
          <label className="field full">
            Product Title
            <Input
              required
              value={f.title}
              onChange={set("title")}
              placeholder="e.g. Tecno Camon 30"
            />
          </label>
          <label className="field">
            Category
            <select value={f.category} onChange={set("category")}>
              {categories.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Badge
            <Input value={f.badge} onChange={set("badge")} />
          </label>
          <label className="field">
            Price (₦)
            <Input required type="number" min={1} value={f.price} onChange={set("price")} />
          </label>
          <label className="field">
            Old Price (₦)
            <Input type="number" min={1} value={f.oldPrice} onChange={set("oldPrice")} />
          </label>
          <label className="field">
            Brand / Supplier
            <Input required value={f.vendor} onChange={set("vendor")} />
          </label>
          <label className="field">
            Stock count
            <Input
              required
              type="number"
              min={0}
              step={1}
              value={f.stock}
              onChange={set("stock")}
            />
          </label>
          <label className="field full">
            Image URL or upload
            <div className="flex gap-2">
              <Input
                value={
                  typeof f.image === "string"
                    ? f.image.startsWith("data:")
                      ? "Uploaded image"
                      : f.image
                    : ""
                }
                onChange={set("image")}
                placeholder="https://…"
              />
              <Input type="file" accept="image/*" className="max-w-56" onChange={upload} />
            </div>
            <ProductImage
              src={f.image}
              alt="Product preview"
              className="admin-preview"
              width={160}
              height={160}
            />
          </label>
          <label className="field">
            Specs (one per line)
            <textarea
              value={f.specs}
              onChange={set("specs")}
              placeholder={"128GB storage\n5000mAh battery"}
            />
          </label>
          <label className="field">
            Description
            <textarea required value={f.description} onChange={set("description")} />
          </label>
        </div>
        <Button type="submit" className="mt-4">
          <Plus />
          Publish Product
        </Button>
      </form>
    </section>
  );
}

function Inventory() {
  const s = useStore();
  function update(id: string, key: "price" | "stock", v: string) {
    const n = Math.max(0, Number(v) || 0);
    s.setCatalog((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, [key]: n, ...(key === "price" && n > p.oldPrice ? { oldPrice: n } : {}) }
          : p,
      ),
    );
  }
  async function remove(p: Product) {
    if (firebaseMode) {
      if (!window.confirm(`Archive ${p.title}? Existing orders will be preserved.`)) return;
      try {
        await callBackend("saveProduct", {
          product: { ...p, active: false },
          expectedStock: p.stock,
        });
        toast.success("Product archived");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Archive failed.");
      }
      return;
    }
    s.setCatalog((prev) => prev.filter((x) => x.id !== p.id));
    s.setCart((prev) => prev.filter((i) => i.product.id !== p.id));
    toast.success("Product removed", { description: p.title });
  }
  return (
    <section className="view-section">
      <div className="inventory-heading">
        <h2>
          <Package size={18} className="text-primary" />
          Inventory
        </h2>
        <span className="stock-badge">{s.catalog.length} active SKUs</span>
      </div>
      <div className="inventory-wrap admin-scroll">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Product / SKU</th>
              <th>Category</th>
              <th>Price (₦)</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {s.catalog.map((p) => (
              <tr key={p.id}>
                <td className="inventory-title">
                  {p.title}
                  <small>
                    {p.sku} · {p.vendor}
                  </small>
                </td>
                <td>{p.category}</td>
                <td>
                  {firebaseMode ? (
                    <BackendInventoryInput
                      key={`${p.id}-price-${p.price}`}
                      product={p}
                      field="price"
                    />
                  ) : (
                    <Input
                      className="admin-num"
                      type="number"
                      min={1}
                      aria-label={`Price for ${p.title}`}
                      value={p.price}
                      onChange={(e) => update(p.id, "price", e.target.value)}
                    />
                  )}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {firebaseMode ? (
                      <BackendInventoryInput
                        key={`${p.id}-stock-${p.stock}`}
                        product={p}
                        field="stock"
                      />
                    ) : (
                      <Input
                        className="admin-num"
                        type="number"
                        min={0}
                        aria-label={`Stock for ${p.title}`}
                        value={p.stock}
                        onChange={(e) => update(p.id, "stock", e.target.value)}
                      />
                    )}
                    {p.stock <= LOW_STOCK && <span className="low-badge">Low</span>}
                  </div>
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${p.title}`}
                    onClick={() => remove(p)}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BackendInventoryInput({ product, field }: { product: Product; field: "price" | "stock" }) {
  const [value, setValue] = useState(String(product[field]));
  const [busy, setBusy] = useState(false);
  async function save() {
    const n = Number(value);
    if (n === product[field]) return;
    setBusy(true);
    try {
      await callBackend("saveProduct", {
        product: {
          ...product,
          [field]: n,
          ...(field === "price" ? { oldPrice: Math.max(n, product.oldPrice) } : {}),
        },
        expectedStock: product.stock,
      });
      toast.success("Inventory updated");
    } catch (error) {
      setValue(String(product[field]));
      toast.error(error instanceof Error ? error.message : "Inventory update failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Input
      className="admin-num"
      aria-label={`${field} for ${product.title}`}
      type="number"
      min={field === "price" ? 1 : 0}
      step={1}
      disabled={busy}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void save()}
    />
  );
}
function BackendDispatch({
  orderId,
  status,
  payment,
  paymentStatus,
}: {
  orderId: string;
  status: string;
  payment: string;
  paymentStatus: string;
}) {
  const [busy, setBusy] = useState(false);
  async function act(next: string) {
    setBusy(true);
    try {
      if (next === "collect") {
        const receipt = window.prompt("Collection receipt / reconciliation reference");
        if (!receipt) return;
        await callBackend("collectPod", { orderId, receipt });
      } else await callBackend("updateOrderStatus", { orderId, status: next });
      toast.success("Order updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order update failed.");
    } finally {
      setBusy(false);
    }
  }
  const next = status === "processing" ? "dispatched" : status === "dispatched" ? "delivered" : "";
  return (
    <div className="flex gap-2">
      {next && (
        <Button disabled={busy} onClick={() => void act(next)}>
          {next}
        </Button>
      )}
      {["pending_payment", "processing"].includes(status) && (
        <Button variant="outline" disabled={busy} onClick={() => void act("cancelled")}>
          Cancel if unpaid
        </Button>
      )}
      {status === "delivered" && payment.startsWith("pod") && paymentStatus === "uncollected" && (
        <Button disabled={busy} onClick={() => void act("collect")}>
          Record POD collection
        </Button>
      )}
    </div>
  );
}
function OrdersTable() {
  const s = useStore();
  return (
    <section className="view-section">
      <div className="inventory-heading">
        <h2>
          <ShoppingCart size={18} className="text-primary" />
          Orders & Dispatch
        </h2>
        <span className="stock-badge">{s.orders.length} orders</span>
      </div>
      <div className="inventory-wrap">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Destination</th>
              <th>Total</th>
              <th>Tracking step</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {s.orders.map((o) => (
              <tr key={o.id}>
                <td className="inventory-title">
                  {o.id}
                  <small>
                    {o.payment} · {o.items.reduce((n, i) => n + i.quantity, 0)} items
                  </small>
                </td>
                <td>
                  {o.zone}, {o.state}
                </td>
                <td className="font-semibold whitespace-nowrap">{money(o.total)}</td>
                <td>
                  <span className="stock-badge">
                    {firebaseMode ? o.backendStatus : `${o.step}: ${orderSteps[o.step - 1]}`}
                  </span>
                </td>
                <td>
                  {firebaseMode ? (
                    <BackendDispatch
                      orderId={o.id}
                      status={o.backendStatus ?? ""}
                      payment={o.payment}
                      paymentStatus={o.paymentStatus ?? ""}
                    />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={o.step >= 4}
                      onClick={() =>
                        s.setOrders((prev) =>
                          prev.map((x) => (x.id === o.id ? advanceOrder(x) : x)),
                        )
                      }
                    >
                      {o.step >= 4 ? "Delivered" : "Advance"}
                      <ChevronRight />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
