import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { firebaseMode } from "@/lib/firebase-client";
import { useFirebaseCommerce } from "./firebase-commerce";
import {
  products,
  categories,
  locations,
  isDeliveryState,
  BUDGET_MAX,
  type DeliveryState,
  type Product,
  type CartItem,
} from "@/lib/commerce";
export type View = "shop" | "checkout" | "orders";
export type MockOrder = {
  id: string;
  total: number;
  state: DeliveryState;
  zone: string;
  payment: string;
  items: CartItem[];
  status: string;
  step: number;
  paymentStatus?: string;
  backendStatus?: string;
};
const KEYS = {
  catalog: "zenvexa-catalog-v2",
  cart: "zenvexa-cart-v2",
  orders: "zenvexa-orders-v2",
};
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    toast.error("Storage is full — this change will not survive a refresh.");
  }
}
function useStoreState() {
  const backend = useFirebaseCommerce();
  const [view, setView] = useState<View>("shop");
  const [catalog, setCatalog] = useState<Product[]>(() => [...products]);
  const [state, setState] = useState<DeliveryState>("Lagos");
  const [zone, setZone] = useState("Ikeja");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [quick, setQuick] = useState<Product | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("All Merchandise");
  const [search, setSearch] = useState("");
  const [awoof, setAwoof] = useState(false);
  const [budget, setBudget] = useState(BUDGET_MAX);
  const [sort, setSort] = useState("featured");
  const [orders, setOrders] = useState<MockOrder[]>(() => [
    {
      id: "ZVX-ORD-8842",
      total: 116450,
      state: "Lagos",
      zone: "Lekki Phase 1",
      payment: "Paystack Checkout",
      items: [
        { product: products[2]!, quantity: 1 },
        { product: products[5]!, quantity: 1 },
      ],
      status: "In Transit",
      step: 3,
    },
  ]);
  const loaded = useRef(false);
  useEffect(() => {
    if (firebaseMode && new URLSearchParams(window.location.search).has("paymentOrder"))
      setView("orders");
    const c = read<Product[]>(KEYS.catalog);
    const b = read<CartItem[]>(KEYS.cart);
    const o = read<MockOrder[]>(KEYS.orders);
    if (c && !firebaseMode) setCatalog(c);
    if (b) setCart(b);
    if (o && !firebaseMode) setOrders(o);
    loaded.current = true;
    function sync(e: StorageEvent) {
      try {
        if (!firebaseMode && e.key === KEYS.catalog && e.newValue)
          setCatalog(JSON.parse(e.newValue));
        if (!firebaseMode && e.key === KEYS.orders && e.newValue) setOrders(JSON.parse(e.newValue));
        if (e.key === KEYS.cart && e.newValue) setCart(JSON.parse(e.newValue));
      } catch {
        toast.error("Saved browser data could not be read.");
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (loaded.current && !firebaseMode) write(KEYS.catalog, catalog);
  }, [catalog]);
  useEffect(() => {
    if (loaded.current) write(KEYS.cart, cart);
  }, [cart]);
  useEffect(() => {
    if (loaded.current && !firebaseMode) write(KEYS.orders, orders);
  }, [orders]);
  function go(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function changeState(next: string) {
    if (!isDeliveryState(next)) return;
    const firstZone = (firebaseMode ? backend.deliveries?.[next] : locations[next])?.zones[0];
    if (!firstZone) return;
    setState(next);
    setZone(firstZone);
  }
  function add(product: Product) {
    if (firebaseMode) {
      const current = backend.catalog.find((p) => p.id === product.id);
      if (!current) {
        toast.error("This product is no longer available.");
        return;
      }
      product = current;
    }
    if ((cart.find((i) => i.product.id === product.id)?.quantity ?? 0) >= product.stock) {
      toast.error("You have reached the available stock.");
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if ((existing?.quantity ?? 0) >= product.stock) {
        toast.error("You have reached the available stock.");
        return prev;
      }
      return existing
        ? prev.map((i) =>
            i.product.id === product.id ? { ...i, product, quantity: i.quantity + 1 } : i,
          )
        : [...prev, { product, quantity: 1 }];
    });
    toast.success("Added to your Hug Bag", { description: product.title });
  }
  function quantity(id: string, n: number) {
    setCart((prev) =>
      prev.flatMap((i) =>
        i.product.id !== id
          ? [i]
          : n <= 0
            ? []
            : [{ ...i, quantity: Math.min(n, i.product.stock) }],
      ),
    );
  }
  useEffect(() => {
    if (firebaseMode) {
      const available = backend.deliveries?.[state]?.zones;
      if (available?.length && !available.includes(zone)) setZone(available[0]!);
    }
  }, [backend.deliveries, state, zone]);
  function wish(id: string) {
    setWishlist((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  useEffect(() => {
    if (firebaseMode && !backend.loading && !backend.error)
      setCart((prev) =>
        prev.flatMap((line) => {
          const current = backend.catalog.find((p) => p.id === line.product.id);
          return current ? [{ ...line, product: current }] : [];
        }),
      );
  }, [backend.catalog, backend.loading, backend.error]);
  return {
    view,
    go,
    catalog: firebaseMode ? backend.catalog : catalog,
    setCatalog,
    state,
    zone,
    setZone,
    changeState,
    cart,
    setCart,
    bagOpen,
    setBagOpen,
    quick,
    setQuick,
    wishlist,
    wish,
    category,
    setCategory,
    search,
    setSearch,
    awoof,
    setAwoof,
    budget,
    setBudget,
    sort,
    setSort,
    orders: firebaseMode ? backend.orders : orders,
    setOrders,
    add,
    quantity,
    count: cart.reduce((n, i) => n + i.quantity, 0),
    user: backend.user,
    authLoading: backend.authLoading,
    staffLoading: backend.staffLoading,
    staffRole: backend.staffRole,
    backendLoading: backend.loading,
    backendError: backend.error,
    catalogueError: backend.catalogueError,
    deliveryError: backend.deliveryError,
    catalogueCategories: firebaseMode ? (backend.catalogueCategories ?? []) : categories,
    catalogueSource: backend.catalogueSource,
    offline: backend.offline,
    deliveryLocations: firebaseMode ? (backend.deliveries ?? {}) : locations,
  };
}
type Store = ReturnType<typeof useStoreState>;
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreState();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("StoreProvider required");
  return store;
}
