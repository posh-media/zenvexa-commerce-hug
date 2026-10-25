import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  type DocumentData,
} from "firebase/firestore";
import { callBackend, firebaseClient, firebaseMode, emulatorMode } from "@/lib/firebase-client";
import { categories, isDeliveryState, type Product, type DeliveryState } from "@/lib/commerce";
import type { MockOrder } from "./store-context";
import { useStore } from "./store-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export type DeliveryInput = {
  recipient: string;
  phone: string;
  address: string;
  landmark: string;
  state: DeliveryState;
  zone: string;
};
function firestoreCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "unavailable";
}
export function useFirebaseCommerce() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(firebaseMode);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffRole, setStaffRole] = useState("");
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [catalogueCategories, setCatalogueCategories] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<
    Partial<Record<DeliveryState, { fee: number; zones: string[]; eta: string }>>
  >({});
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [loading, setLoading] = useState(firebaseMode);
  const [catalogueError, setCatalogueError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [orderError, setOrderError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [catalogueSource, setCatalogueSource] = useState("loading");
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!firebaseMode) return;
    try {
      const { auth, db } = firebaseClient();
      const offAuth = onAuthStateChanged(auth, (next) => {
        setUser(next);
        setAuthLoading(false);
        setStaffLoading(Boolean(next));
        setStaffRole("");
        setOrders([]);
      });
      const offCatalog = onSnapshot(
        query(collection(db, "products"), where("active", "==", true)),
        { includeMetadataChanges: true },
        (snapshot) => {
          setCatalogueSource(snapshot.metadata.fromCache ? "firestore-cache" : "firestore");
          setCatalog(
            snapshot.docs.map((record) => {
              const data = record.data();
              return {
                id: record.id,
                title: data["title"],
                category: data["category"],
                price: data["price"],
                oldPrice: data["oldPrice"],
                badge: data["badge"],
                vendor: data["vendor"],
                specs: data["specs"],
                description: data["description"],
                image: data["image"],
                sku: data["sku"],
                stock: data["stock"],
                reviews: data["reviews"] ?? 0,
                rating: data["rating"] ?? 0,
                slug: data["slug"],
                shortDescription: data["shortDescription"],
                categoryId: data["categoryId"],
                currency: "NGN",
                images: data["images"] ?? [data["image"]],
                featured: data["featured"] === true,
                active: data["active"],
                imageStatus: data["imageStatus"],
                imageNotes: data["imageNotes"],
                reviewSource: data["reviewSource"] ?? "unverified",
                version: data["version"] ?? 0,
              } as Product;
            }),
          );
          setLoading(false);
          setCatalogueError("");
        },
        (failure) => {
          setCatalog([]);
          setLoading(false);
          setCatalogueError(
            `Catalogue unavailable (${firestoreCode(failure)}). Public Firestore rules or connectivity are blocking product reads.`,
          );
        },
      );
      const offCategories = onSnapshot(
        collection(db, "categories"),
        (snapshot) => {
          const available = new Set(
            snapshot.docs
              .map((record) => record.data()["name"])
              .filter((name): name is string => typeof name === "string"),
          );
          setCatalogueCategories([
            categories[0]!,
            ...categories.slice(1).filter((name) => available.has(name)),
          ]);
          setCatalogueError("");
        },
        (failure) => {
          setCatalogueCategories([]);
          setCatalogueError(
            `Category configuration unavailable (${firestoreCode(failure)}). Public Firestore rules or connectivity are blocking category reads.`,
          );
        },
      );
      const offDelivery = onSnapshot(
        collection(db, "deliveryZones"),
        (snapshot) => {
          const next: Partial<
            Record<DeliveryState, { fee: number; zones: string[]; eta: string }>
          > = {};
          for (const doc of snapshot.docs) {
            const d = doc.data();
            if (
              isDeliveryState(String(d["state"])) &&
              d["active"] === true &&
              Number.isSafeInteger(d["fee"]) &&
              d["fee"] >= 0 &&
              Array.isArray(d["zones"]) &&
              typeof d["eta"] === "string"
            )
              next[d["state"] as DeliveryState] = {
                fee: d["fee"],
                zones: d["zones"],
                eta: d["eta"],
              };
          }
          setDeliveries(next);
          setDeliveryError("");
        },
        (failure) => {
          setDeliveries({});
          setDeliveryError(
            `Delivery configuration unavailable (${firestoreCode(failure)}). Checkout is disabled until it can be loaded.`,
          );
        },
      );
      return () => {
        offAuth();
        offCatalog();
        offCategories();
        offDelivery();
      };
    } catch (e) {
      setAuthLoading(false);
      setLoading(false);
      setSetupError(e instanceof Error ? e.message : "Firebase configuration unavailable.");
    }
    return undefined;
  }, []);
  useEffect(() => {
    if (!firebaseMode || !user) return;
    return onSnapshot(
      doc(firebaseClient().db, "staff", user.uid),
      (snapshot) => {
        const data = snapshot.data();
        setStaffRole(data?.["active"] === true && user.emailVerified ? String(data["role"]) : "");
        setStaffLoading(false);
      },
      () => {
        setStaffRole("");
        setStaffLoading(false);
      },
    );
  }, [user]);
  useEffect(() => {
    if (!firebaseMode || !user) return;
    const ordersQuery = query(
      collection(firebaseClient().db, "orders"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(100),
    );
    return onSnapshot(
      ordersQuery,
      (snapshot) => {
        setOrders(snapshot.docs.map((record) => adaptOrder(record.id, record.data())));
        setOrderError("");
      },
      (failure) => {
        setOrders([]);
        setOrderError(
          `Orders could not be loaded (${firestoreCode(failure)}). Please retry when connected.`,
        );
      },
    );
  }, [user, staffRole]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    return () => {
      window.removeEventListener("offline", update);
      window.removeEventListener("online", update);
    };
  }, []);
  const error = [setupError, catalogueError, deliveryError, orderError].filter(Boolean).join(" ");
  return {
    user,
    authLoading,
    staffLoading,
    staffRole,
    catalog,
    catalogueCategories,
    orders,
    loading,
    error,
    catalogueError,
    deliveryError,
    catalogueSource,
    offline,
    deliveries,
  };
}
function adaptOrder(id: string, data: DocumentData): MockOrder {
  const step =
    data["status"] === "delivered"
      ? 4
      : data["status"] === "dispatched"
        ? 3
        : data["status"] === "processing"
          ? 2
          : 1;
  return {
    id,
    total: data["total"],
    state: data["delivery"].state,
    zone: data["delivery"].zone,
    payment: `${data["paymentMethod"]} · ${data["paymentStatus"]}`,
    paymentStatus: data["paymentStatus"],
    backendStatus: data["status"],
    status: data["status"],
    step,
    items: data["items"].map((line: DocumentData) => ({
      quantity: line["quantity"],
      product: {
        id: line["productId"],
        title: line["title"],
        image: line["image"],
        price: line["unitPrice"],
        sku: line["sku"],
        category: "",
        oldPrice: line["unitPrice"],
        stock: 0,
        rating: 0,
        reviews: 0,
        badge: "",
        vendor: "",
        specs: [],
        description: "",
      },
    })),
  };
}
export function FirebaseAccount() {
  const s = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  if (!firebaseMode) return null;
  async function action(kind: "login" | "signup" | "guest" | "logout" | "verify") {
    setBusy(true);
    try {
      const { auth } = firebaseClient();
      if (kind === "login") await signInWithEmailAndPassword(auth, email, password);
      if (kind === "signup") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(credential.user);
        toast.info("Verification email sent. Verify, then sign in again.");
      }
      if (kind === "guest") await signInAnonymously(auth);
      if (kind === "logout") await signOut(auth);
      if (kind === "verify" && auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        toast.info("Verification email sent.");
      }
    } catch {
      toast.error("Account action failed. Check details, enabled providers and connectivity.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  return (
    <section className="container-page view-section" aria-label="Firebase account">
      <p>
        {emulatorMode
          ? "Local Firebase emulators · sample details only"
          : "Firebase backend · electronic payments require configured test mode"}
      </p>
      {s.backendError && <p role="alert">{s.backendError}</p>}
      {s.backendLoading && <p role="status">Loading catalogue…</p>}
      {s.catalogueSource === "firestore" && (
        <p data-catalogue-source="firestore">
          {s.catalog.length} active products confirmed by{" "}
          {emulatorMode ? "the Firestore emulator" : "Firestore"}.
        </p>
      )}
      {(s.offline || s.catalogueSource === "firestore-cache") && (
        <p role="status">
          Cached/offline catalogue. Availability may have changed; checkout requires the server.
        </p>
      )}
      {s.user ? (
        <div className="flex flex-wrap gap-2">
          <span>
            {s.user.isAnonymous
              ? "Guest session — history is tied to this browser identity"
              : s.user.email}
          </span>
          <Button disabled={busy} onClick={() => void action("logout")}>
            Sign out
          </Button>
          {!s.user.isAnonymous && !s.user.emailVerified && (
            <Button disabled={busy} onClick={() => void action("verify")}>
              Verify email
            </Button>
          )}
        </div>
      ) : (
        <div className="form-grid">
          <label className="field">
            Email
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Password
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void action("login")}>
              Sign in
            </Button>
            <Button disabled={busy} onClick={() => void action("signup")}>
              Create account
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => void action("guest")}>
              Continue as guest
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
export async function submitBackendOrder(
  key: string,
  cart: { product: Product; quantity: number }[],
  delivery: DeliveryInput,
  paymentMethod: string,
  promo: string,
) {
  return callBackend<{ id: string; total: number; paymentMethod: string }>("createOrder", {
    key,
    items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    delivery,
    paymentMethod,
    promo,
  });
}
