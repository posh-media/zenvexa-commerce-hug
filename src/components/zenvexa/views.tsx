import { useRef, useState, type FormEvent } from "react";
import { firebaseMode } from "@/lib/firebase-client";
import { submitBackendOrder } from "./firebase-commerce";
import { FirebaseOrderActions } from "./firebase-order-actions";
import { ProductImage } from "./product-image";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Info,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "./store-context";
import { Countdown } from "./storefront";
import { locations, money, cartSubtotal, promoDiscount, orderTotal } from "@/lib/commerce";
const payments = [
  {
    id: "card",
    title: "Paystack Checkout",
    description: "Verve, Mastercard, Visa & OPay",
    icon: CreditCard,
  },
  {
    id: "transfer",
    title: "Instant Bank Transfer",
    description: "Transfer to your dedicated account",
    icon: Banknote,
  },
  {
    id: "ussd",
    title: "Bank USSD Code",
    description: "Quick payment. No internet needed.",
    icon: Smartphone,
  },
  {
    id: "pod",
    title: "Pay on Delivery",
    description: "POS or transfer at your doorstep",
    icon: Truck,
  },
];
export function Checkout() {
  const s = useStore();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState("card");
  const [promo, setPromo] = useState("");
  const [applied, setApplied] = useState("");
  const [copied, setCopied] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const subtotal = cartSubtotal(s.cart);
  const discount = promoDiscount(applied, subtotal);
  function apply() {
    const code = promo.trim().toUpperCase();
    if (!["HUG10", "NAIJA5K"].includes(code)) {
      toast.error("That promo code isn’t valid. Try HUG10 or NAIJA5K.");
      return;
    }
    if (code === "NAIJA5K" && subtotal <= 50000) {
      toast.error("NAIJA5K is available on merchandise above ₦50,000.");
      return;
    }
    setApplied(code);
    toast.success(`${code} applied. Your hug just got sweeter!`);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText("9940281746");
      setCopied(true);
      toast.success("Demo account number copied");
    } catch {
      toast.error("Copy unavailable. Account: 9940281746");
    }
  }
  async function place(e: FormEvent) {
    e.preventDefault();
    if (submitting.current || !s.cart.length) return;
    if (firebaseMode) {
      if (s.offline || !s.deliveryLocations[s.state]) {
        toast.error(
          "Reconnect and load a supported delivery configuration before placing an order.",
        );
        return;
      }
      if (!s.user) {
        toast.error("Sign in or continue as guest before checkout.");
        return;
      }
      if (payment !== "pod" && !s.user.emailVerified) {
        toast.error(
          "Verify an email account before electronic checkout. Guests can use Pay on Delivery.",
        );
        return;
      }
      submitting.current = true;
      setBusy(true);
      try {
        const delivery = { recipient, phone, address, landmark, state: s.state, zone: s.zone };
        const fingerprint = JSON.stringify({
          items: s.cart.map((i) => [i.product.id, i.quantity]),
          delivery,
          payment,
          promo: applied,
        });
        const saved = JSON.parse(sessionStorage.getItem("zenvexa-checkout-request") ?? "null") as {
          fingerprint: string;
          key: string;
        } | null;
        const key = saved?.fingerprint === fingerprint ? saved.key : crypto.randomUUID();
        sessionStorage.setItem("zenvexa-checkout-request", JSON.stringify({ fingerprint, key }));
        const order = await submitBackendOrder(key, s.cart, delivery, payment, applied);
        sessionStorage.removeItem("zenvexa-checkout-request");
        s.setCart([]);
        toast.success(`Order saved. Server total: ${money(order.total)}`, {
          description: "Review your order. Creation is not payment confirmation.",
        });
        s.go("orders");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Order could not be saved. Retry the same details safely.",
        );
      } finally {
        submitting.current = false;
        setBusy(false);
      }
      return;
    }
    if (!/^(\+234|0)[789][01]\d{8}$/.test(phone.replace(/[\s-]/g, ""))) {
      toast.error("Please enter a valid Nigerian phone number.");
      return;
    }
    s.setOrders((prev) => [
      {
        id: `ZVX-ORD-${8843 + prev.length - 1}`,
        total: orderTotal(s.cart, s.state, applied),
        state: s.state,
        zone: s.zone,
        payment: payments.find((p) => p.id === payment)?.title ?? "Paystack Checkout",
        items: s.cart,
        status: "Order Confirmed",
        step: 1,
      },
      ...prev,
    ]);
    s.setCart([]);
    toast.success("Your demo order is confirmed!", { description: "No payment was collected." });
    s.go("orders");
  }
  if (!s.cart.length)
    return (
      <main className="container-page view-page">
        <div className="empty-state">
          <ShoppingBag />
          <h2>Your Hug Bag is empty</h2>
          <p>Pick a few everyday essentials before heading to checkout.</p>
          <Button onClick={() => s.go("shop")}>
            Back to shopping
            <ArrowRight />
          </Button>
        </div>
      </main>
    );
  return (
    <main className="container-page view-page">
      <Button variant="link" className="mb-5 p-0" onClick={() => s.go("shop")}>
        <ArrowLeft />
        Keep shopping
      </Button>
      <div className="page-eyebrow">One more step to a warm hug</div>
      <h1 className="page-title">Nigerian Checkout</h1>
      <p className="page-subtitle">
        Your essentials, on their way. Let’s make the details just right.
      </p>
      <div className="demo-notice">
        <Info size={15} />
        {firebaseMode
          ? "Firebase checkout: totals and stock are checked by the server. Electronic payments are disabled unless Paystack test mode is configured."
          : "Preview checkout only. Use sample details; no money will be collected and no delivery will be booked."}
      </div>
      <form onSubmit={place} className="checkout-layout">
        <div>
          <section className="view-section">
            <h2>
              <span className="step-number">1</span>Nigerian Delivery Address
            </h2>
            <div className="form-grid">
              <label className="field">
                Recipient Name
                <Input
                  required
                  placeholder="e.g. Tolu Adeyemi"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </label>
              <label className="field">
                Active Phone / WhatsApp
                <Input
                  required
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="field">
                State
                <select value={s.state} onChange={(e) => s.changeState(e.target.value)}>
                  {Object.keys(s.deliveryLocations).map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                LGA / Delivery Zone
                <select value={s.zone} onChange={(e) => s.setZone(e.target.value)}>
                  {(s.deliveryLocations[s.state]?.zones ?? []).map((zone) => (
                    <option key={zone}>{zone}</option>
                  ))}
                </select>
              </label>
              <label className="field full">
                Street Address
                <Input
                  required
                  placeholder="House number, street name and area"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <label className="field full">
                Closest Landmark
                <Input
                  required
                  placeholder="e.g. Opposite the Total filling station"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                />
                <small>A familiar landmark helps your dispatch rider find you faster.</small>
              </label>
            </div>
          </section>
          <section className="view-section">
            <h2>
              <span className="step-number">2</span>Pay Your Naija Way
            </h2>
            <div className="payment-grid">
              {payments.map((p) => (
                <Button
                  type="button"
                  variant="ghost"
                  className={`payment-option ${payment === p.id ? "selected" : ""}`}
                  key={p.id}
                  onClick={() => setPayment(p.id)}
                  aria-pressed={payment === p.id}
                >
                  <p.icon />
                  <span>
                    <strong>{p.title}</strong>
                    <small>{p.description}</small>
                  </span>
                  <span className="radio-dot" />
                </Button>
              ))}
            </div>
            {!firebaseMode && payment === "transfer" && (
              <div className="transfer-card">
                <div className="flex items-center justify-between text-xs">
                  <span>Paystack · Titan Trust Bank</span>
                  <Countdown initial={15 * 60} />
                </div>
                <p>Demo virtual account — do not send money</p>
                <div className="account-number">
                  <span>9940281746</span>
                  <Button
                    type="button"
                    variant="hero"
                    size="icon"
                    aria-label="Copy account number"
                    title="Copy account number"
                    onClick={copy}
                  >
                    {copied ? <Check /> : <Copy />}
                  </Button>
                </div>
                <span className="text-xs">Account name: Zenvexa Commerce Hug</span>
              </div>
            )}
            {!firebaseMode && payment === "ussd" && (
              <div className="ussd-card">
                <strong>Demo USSD payment codes</strong>
                <p>GTBank</p>
                <code>*737*000*88412#</code>
                <p>UBA</p>
                <code>*919*000*88412#</code>
                <small>Preview codes only. Do not dial or send a payment.</small>
              </div>
            )}
            {payment === "pod" && (
              <p className="mt-4 text-xs leading-6 text-muted-foreground">
                Pay by POS or transfer to your dispatch rider at your doorstep. Your delivery is
                protected by the Zenvexa Hug Promise.
              </p>
            )}
          </section>
        </div>
        <aside className="summary-card">
          <h2>Your Order Summary</h2>
          <div className="summary-items">
            {s.cart.map((i) => (
              <div className="summary-item" key={i.product.id}>
                <ProductImage src={i.product.image} alt={i.product.title} width={59} height={59} />
                <div>
                  <h3>{i.product.title}</h3>
                  <p>
                    {i.quantity} × {money(i.product.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <label className="text-xs font-semibold" htmlFor="promo">
            A little extra awoof?
          </label>
          <div className="promo-form">
            <Input
              id="promo"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="HUG10 or NAIJA5K"
            />
            <Button variant="outline" type="button" onClick={apply}>
              Apply
            </Button>
          </div>
          {applied && (
            <div className="flex items-center justify-between text-xs text-primary">
              <span>
                <CheckCircle2 size={12} className="inline mr-1" />
                {applied} applied
              </span>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => {
                  setApplied("");
                  setPromo("");
                }}
              >
                Remove
              </Button>
            </div>
          )}
          <div className="summary-line muted">
            <span>Merchandise subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <div className="summary-line discount">
            <span>Promo discount</span>
            <strong>−{money(discount)}</strong>
          </div>
          <div className="summary-line muted">
            <span>Logistics · {s.state}</span>
            <strong>
              {s.deliveryLocations[s.state]
                ? money(s.deliveryLocations[s.state]!.fee)
                : "Unavailable"}
            </strong>
          </div>
          <p className="text-[10px] text-muted-foreground">
            To {s.zone} · {s.deliveryLocations[s.state]?.eta ?? "Unavailable"}
          </p>
          <div className="summary-line summary-total">
            <span>Total Due</span>
            <strong>
              {s.deliveryLocations[s.state]
                ? money(Math.max(0, subtotal - discount) + s.deliveryLocations[s.state]!.fee)
                : "Quote unavailable"}
            </strong>
          </div>
          <Button
            type="submit"
            variant="amber"
            className="place-order"
            disabled={busy || (firebaseMode && (s.offline || !s.deliveryLocations[s.state]))}
          >
            {busy
              ? "Saving order…"
              : firebaseMode
                ? "Create Order — Not Yet Paid"
                : "Confirm Demo Order"}
            <ArrowRight />
          </Button>
          <p className="summary-note">
            <ShieldCheck size={12} />
            Review your server-calculated order before payment.
          </p>
        </aside>
      </form>
    </main>
  );
}
const steps = [
  { title: "Order Confirmed", description: "Your hug is officially on the way.", icon: Check },
  {
    title: "Packed at Zenvexa Lagos Fulfillment Hub",
    description: "Carefully packed, checked and ready.",
    icon: Package,
  },
  { title: "Out with Dispatch Rider", description: "Musa · 0802-XXX-9910", icon: Truck },
  {
    title: "Delivered with a Hug",
    description: "A warm welcome at your doorstep.",
    icon: ShoppingBag,
  },
];
export function Orders() {
  const s = useStore();
  return (
    <main className="container-page view-page">
      <div className="page-eyebrow">Every hug has a journey</div>
      <h1 className="page-title">Track Your Orders</h1>
      <p className="page-subtitle">
        From our fulfillment hub to your front door, stay in the loop.
      </p>
      <div className="demo-notice">
        <Info size={15} />
        {firebaseMode
          ? "Your authenticated orders. Payment collection and delivery status are separate."
          : "Sample tracking activity. Orders and delivery updates in this preview are simulated."}
      </div>
      {s.orders.map((order) => (
        <article className="order-card" key={order.id}>
          <div className="order-head">
            <h2>{order.id}</h2>
            <span className="status-badge">{order.status}</span>
          </div>
          <div className="order-details">
            <div>
              <small>Payment method</small>
              <strong>{order.payment}</strong>
            </div>
            <div>
              <small>{!firebaseMode && order.step === 3 ? "Total paid" : "Order total"}</small>
              <strong>{money(order.total)}</strong>
            </div>
            <div>
              <small>Destination</small>
              <strong>
                {order.zone}, {order.state}
              </strong>
            </div>
            <div>
              <small>Expected delivery</small>
              <strong>{locations[order.state].eta}</strong>
            </div>
          </div>
          {firebaseMode && <FirebaseOrderActions order={order} />}
          {!firebaseMode && (
            <div className="order-timeline">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className={`timeline-step ${i < order.step - 1 ? "complete" : ""} ${i === order.step - 1 ? "current" : ""}`}
                >
                  <div className="timeline-icon">
                    <step.icon />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              ))}
            </div>
          )}
          {!firebaseMode && order.step === 3 && (
            <div className="rider-info">
              <div className="flex items-center gap-3">
                <div className="trust-icon">
                  <Truck />
                </div>
                <div>
                  <h3>Musa is bringing your hug</h3>
                  <p>Your rider · 0802-XXX-9910 · Lagos Express</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  toast.info(
                    "Musa is a sample dispatch rider. Live contact arrives in the next phase.",
                  )
                }
              >
                <Phone />
                Contact Rider
              </Button>
            </div>
          )}
          <div className="order-products">
            {order.items.map((i) => (
              <ProductImage
                key={i.product.id}
                src={i.product.image}
                alt={i.product.title}
                width={45}
                height={45}
              />
            ))}
            <p>
              {order.items.reduce((n, i) => n + i.quantity, 0)} items, packed with care{" "}
              <span className="block mt-1">
                {order.items
                  .map((i) => i.product.title.split(" ").slice(0, 3).join(" "))
                  .join(" · ")}
              </span>
            </p>
          </div>
        </article>
      ))}
    </main>
  );
}
