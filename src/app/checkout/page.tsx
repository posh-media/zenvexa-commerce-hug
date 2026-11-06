"use client";
import { requireStoreName } from "@/lib/store";
import { getAppSettings } from "@/services/settings.service";
import type { AppSettings } from "@/types/settings";

import { OrderSummary } from "@/components/commerce/order-summary";
import { ProductMedia } from "@/components/commerce/product-media";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Radio, Select, Textarea } from "@/components/ui/field";
import { EmptyCartIllustration } from "@/components/ui/illustrations";
import {
  cartSubtotal,
  DELIVERY_OPTIONS,
  deliveryFeeFor,
  getGuestId,
  orderGrandTotal,
  type DeliveryOptionId,
} from "@/lib/cart";
import { applyCouponCode } from "@/lib/coupons";
import { formatPrice } from "@/lib/utils";
import { placeOrder } from "@/services/orders.service";
import {
  getPaymentProviderSettings,
  clearPaymentProviderSettingsCache,
  type PaymentProviderSettings,
  initializeBachsPayment,
  initializeCodCommitmentFeePayment,
  initializeKorapayPayment,
  initializeMonnifyPayment,
  initializePaystackPayment,
  initializeSquadPayment,
  type CodFeeGateway,
} from "@/services/payments.service";
import { useCartStore } from "@/stores/cart.store";
import { useCheckoutStore } from "@/stores/checkout.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import { useUserStore } from "@/stores/user.store";
import type { PaymentMethod } from "@/types/order";
import type { Address } from "@/types/user";
import { Check, CreditCard, Lock, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// Payment Provider Options Component
function PaymentProviderOptions({
  selectedProvider,
  onSelectProvider,
  deliveryState,
  commitmentFee,
}: {
  selectedProvider: PaymentMethod | null;
  onSelectProvider: (provider: PaymentMethod) => void;
  deliveryState: string;
  commitmentFee: number;
}) {
  const [providers, setProviders] = useState<PaymentProviderSettings | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const loadProviders = async () => {
      const settings = await getPaymentProviderSettings();
      setProviders({
        ...settings,
        codAllowedStates: Array.isArray(settings.codAllowedStates)
          ? settings.codAllowedStates
          : [],
      });
    };
    void loadProviders();
  }, [loadAttempt]);

  if (!providers) {
    return <div className="text-sm text-muted">Loading payment options...</div>;
  }

  if (providers.availabilityError) return (
    <div role="alert" className="space-y-3 text-sm text-red-700">
      <p>{providers.availabilityError}</p>
      <Button type="button" onClick={() => { clearPaymentProviderSettingsCache(); setProviders(null); setLoadAttempt((attempt) => attempt + 1); }}>Retry payment options</Button>
    </div>
  );
  if (![providers.paystack, providers.korapay, providers.squad, providers.monnify, providers.bachs, providers.cod].some(Boolean)) {
    return <p role="status" className="text-sm text-muted">No payment methods are currently enabled for this store. Please contact support.</p>;
  }
  const allowedStates = providers.codAllowedStates ?? [];
  const normalizedState = deliveryState
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  const codAllowed =
    providers.cod &&
    allowedStates.length > 0 &&
    normalizedState.length > 0 &&
    allowedStates.some(
      (s) => s.trim().replace(/\s+/g, " ").toLowerCase() === normalizedState,
    );

  return (
    <>
      {providers.paystack && (
        <Radio
          name="payment"
          checked={
            selectedProvider === "paystack" || selectedProvider === "card"
          }
          onChange={() => onSelectProvider("paystack")}
          label="Paystack (card / bank / USSD)"
          description="You will be redirected to Paystack to complete payment"
        />
      )}
      {providers.korapay && (
        <Radio
          name="payment"
          checked={selectedProvider === "korapay"}
          onChange={() => onSelectProvider("korapay")}
          label="KoraPay (card / bank / USSD)"
          description="You will be redirected to KoraPay to complete payment"
        />
      )}
      {providers.squad && (
        <Radio
          name="payment"
          checked={selectedProvider === "squad"}
          onChange={() => onSelectProvider("squad")}
          label="Squad by GTBank (card / bank / USSD)"
          description="You will be redirected to Squad to complete payment"
        />
      )}
      {providers.monnify && (
        <Radio
          name="payment"
          checked={selectedProvider === "monnify"}
          onChange={() => onSelectProvider("monnify")}
          label="Monnify (card / bank / USSD)"
          description="You will be redirected to Monnify to complete payment"
        />
      )}
      {providers.bachs && (
        <Radio
          name="payment"
          checked={selectedProvider === "bachs"}
          onChange={() => onSelectProvider("bachs")}
          label="Bachs (card / bank transfer / mobile money)"
          description="You will be redirected to Bachs to complete payment"
        />
      )}
      {providers.cod && (
        <Radio
          name="payment"
          checked={selectedProvider === "cash-on-delivery"}
          onChange={() => {
            if (!codAllowed) return;
            onSelectProvider("cash-on-delivery");
          }}
          label="Cash on delivery"
          description={
            codAllowed
              ? "Pay on delivery — a 25% commitment fee is required online first"
              : "Not available in your area"
          }
        />
      )}
      {providers.cod && !codAllowed ? (
        <p className="ml-8 text-[12px] text-amber-700" role="note">
          Payment on delivery is only allowed in the following areas:{" "}
          {allowedStates.length ? allowedStates.join(", ") : "none configured"}.
          A 25% commitment fee is required.
        </p>
      ) : null}
      {providers.cod &&
      codAllowed &&
      selectedProvider === "cash-on-delivery" ? (
        <p className="ml-8 text-[12px] text-amber-700" role="note">
          A 25% commitment fee ({formatPrice(commitmentFee)}) must be paid
          online before this order is confirmed. You pay the remaining balance
          on delivery.
        </p>
      ) : null}
      {providers.flutterwave && (
        <Radio
          name="payment"
          checked={selectedProvider === "flutterwave"}
          onChange={() => onSelectProvider("flutterwave")}
          label="Flutterwave"
          description="Flutterwave checkout"
        />
      )}
    </>
  );
}

const steps = [
  { label: "Cart", state: "done" as const },
  { label: "Shipping", state: "current" as const },
  { label: "Payment", state: "upcoming" as const },
  { label: "Review", state: "upcoming" as const },
];

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state.hydrated);
  const authUser = useUserStore((state) => state.authUser);

  const customer = useCheckoutStore((state) => state.customer);
  const setCustomer = useCheckoutStore((state) => state.setCustomer);
  const deliveryNotes = useCheckoutStore((state) => state.deliveryNotes);
  const setDeliveryNotes = useCheckoutStore((state) => state.setDeliveryNotes);
  const deliveryOptionId = useCheckoutStore((state) => state.deliveryOptionId);
  const setDeliveryOptionId = useCheckoutStore(
    (state) => state.setDeliveryOptionId,
  );
  const paymentMethod = useCheckoutStore((state) => state.paymentMethod);
  const setPaymentMethod = useCheckoutStore((state) => state.setPaymentMethod);
  const couponCode = useCheckoutStore((state) => state.couponCode);
  const couponDiscount = useCheckoutStore((state) => state.couponDiscount);
  const setCouponCode = useCheckoutStore((state) => state.setCouponCode);
  const setCouponDiscount = useCheckoutStore(
    (state) => state.setCouponDiscount,
  );
  const submitting = useCheckoutStore((state) => state.submitting);
  const setSubmitting = useCheckoutStore((state) => state.setSubmitting);
  const error = useCheckoutStore((state) => state.error);
  const setError = useCheckoutStore((state) => state.setError);
  const setLastOrder = useCheckoutStore((state) => state.setLastOrder);
  const setShippingAddress = useCheckoutStore(
    (state) => state.setShippingAddress,
  );

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [codFeeGateway, setCodFeeGateway] = useState<CodFeeGateway>("paystack");
  const [codFeeGateways, setCodFeeGateways] = useState<
    Record<CodFeeGateway, boolean>
  >({
    paystack: false,
    korapay: false,
    squad: false,
    monnify: false,
    bachs: false,
  });

  useEffect(() => {
    void getPaymentProviderSettings().then((settings) => {
      const enabled = {
        paystack: settings.paystack,
        korapay: settings.korapay,
        squad: settings.squad,
        monnify: settings.monnify,
        bachs: settings.bachs,
      };
      setCodFeeGateways(enabled);
      const first = (Object.keys(enabled) as CodFeeGateway[]).find(
        (g) => enabled[g],
      );
      if (first) setCodFeeGateway(first);
    });
  }, []);
  const [couponHint, setCouponHint] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  // Auto-select first available payment method if none selected
  useEffect(() => {
    if (paymentMethod) return;

    // Get payment provider settings
    const loadSettings = async () => {
      const settings = await getPaymentProviderSettings();

      if (settings.paystack) {
        setPaymentMethod("paystack");
      } else if (settings.korapay) {
        setPaymentMethod("korapay");
      } else if (settings.flutterwave) {
        setPaymentMethod("flutterwave");
      } else if (settings.cod) {
        setPaymentMethod("cash-on-delivery");
      } else if (settings.squad) {
        setPaymentMethod("squad");
      } else if (settings.monnify) {
        setPaymentMethod("monnify");
      } else if (settings.bachs) {
        setPaymentMethod("bachs");
      }
    };

    void loadSettings();
  }, [paymentMethod, setPaymentMethod]);

  const [storeSettings, setStoreSettings] = useState<AppSettings>();
  const [configurationError, setConfigurationError] = useState<string>();
  useEffect(() => {
    void getAppSettings()
      .then((settings) => {
        requireStoreName(settings);
        setStoreSettings(settings);
      })
      .catch(() =>
        setConfigurationError(
          "Admin has not configured the store name. Please contact support.",
        ),
      );
  }, []);
  const subtotal = cartSubtotal(items);
  const shipping =
    storeSettings?.deliveryOptions?.find(
      (option) => option.id === deliveryOptionId,
    )?.fee ?? deliveryFeeFor(deliveryOptionId, subtotal);
  const { tax, total } = orderGrandTotal({
    subtotal,
    discount: couponDiscount,
    shipping,
    taxRate: storeSettings?.taxRate ?? 0.075,
  });

  const fullName = useMemo(
    () => `${customer.firstName} ${customer.lastName}`.trim(),
    [customer.firstName, customer.lastName],
  );

  const validate = (): Address | null => {
    if (configurationError || !storeSettings) {
      setError(configurationError || "Store settings are loading.");
      return null;
    }
    if (!items.length) {
      setError("Your cart is empty.");
      return null;
    }
    if (!customer.firstName.trim() || !customer.lastName.trim()) {
      setError("Enter your first and last name.");
      return null;
    }
    if (!customer.email.trim() || !customer.email.includes("@")) {
      setError("Enter a valid email address.");
      return null;
    }
    if (!customer.phone.trim() || customer.phone.trim().length < 7) {
      setError("Enter a valid phone number.");
      return null;
    }
    if (!street.trim() || !city.trim() || !country.trim()) {
      setError("Complete your shipping address.");
      return null;
    }
    for (const line of items) {
      if (line.stock < line.quantity) {
        setError(
          line.stock <= 0
            ? `"${line.name}" is out of stock.`
            : `Only ${line.stock} of "${line.name}" left.`,
        );
        return null;
      }
    }

    const address: Address = {
      fullName,
      phone: customer.phone.trim(),
      line1: street.trim(),
      line2: "",
      city: city.trim(),
      state: stateName.trim(),
      postalCode: postalCode.trim(),
      country: country.trim(),
      isDefault: true,
    };
    setShippingAddress(address);
    setError(null);
    return address;
  };

  const handlePlaceOrder = async () => {
    const address = validate();
    if (!address) return;

    const method = (paymentMethod ?? "cash-on-delivery") as PaymentMethod;
    if (method === "flutterwave") {
      setError("Flutterwave is coming soon. Please pay with Paystack or COD.");
      return;
    }

    // Get payment provider settings
    const settings = await getPaymentProviderSettings();
    if (settings.availabilityError) {
      setError(settings.availabilityError);
      return;
    }

    if (method === "paystack" && !settings.paystack) {
      setError(
        "Card payment is temporarily unavailable. Choose cash on delivery or try again later.",
      );
      return;
    }
    if (method === "squad" && !settings.squad) {
      setError("Squad is currently disabled.");
      toastError("Payment unavailable", "Squad is currently disabled.");
      return;
    }
    if (method === "monnify" && !settings.monnify) {
      setError("Monnify is currently disabled.");
      toastError("Payment unavailable", "Monnify is currently disabled.");
      return;
    }
    if (method === "bachs" && !settings.bachs) {
      setError("Bachs is currently disabled.");
      toastError("Payment unavailable", "Bachs is currently disabled.");
      return;
    }

    if (method === "korapay" && !settings.korapay) {
      setError(
        "KoraPay payment is temporarily unavailable. Choose cash on delivery or try again later.",
      );
      return;
    }
    if (method === "cash-on-delivery") {
      if (!settings.cod) {
        setError("Cash on delivery is not available right now.");
        return;
      }
      const allowedStates = Array.isArray(settings.codAllowedStates)
        ? settings.codAllowedStates
        : [];
      const normalizedState = stateName
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
      const stateAllowed =
        normalizedState.length > 0 &&
        allowedStates.some(
          (s) =>
            s.trim().replace(/\s+/g, " ").toLowerCase() === normalizedState,
        );
      if (!stateAllowed) {
        setError(
          `Payment on delivery is only allowed in the following areas: ${allowedStates.length ? allowedStates.join(", ") : "none configured"}. A 25% commitment fee is required.`,
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      console.log(
        JSON.stringify({
          payment: {
            at: new Date().toISOString(),
            stage: "checkout.button",
            message: "Pay with Paystack clicked",
            method,
            itemCount: items.length,
            total,
          },
        }),
      );

      const result = await placeOrder({
        userId: authUser?.uid ?? `guest_${getGuestId()}`,
        customer: {
          name: fullName,
          email: customer.email.trim(),
          phone: customer.phone.trim(),
        },
        lines: items,
        shippingAddress: address,
        deliveryFee: shipping,
        discount: couponDiscount,
        tax,
        subtotal,
        total,
        paymentMethod: method,
        notes: deliveryNotes.trim(),
        deliveryOptionId,
        couponCode: couponCode.trim(),
      });

      if (!result.ok) {
        setError(result.reason);
        toastError("Order failed", result.reason);
        return;
      }

      console.log(
        JSON.stringify({
          payment: {
            at: new Date().toISOString(),
            stage: "checkout.order",
            message: "Pending order created",
            orderId: result.order.id,
            orderNumber: result.order.orderNumber,
            paymentStatus: result.order.paymentStatus,
          },
        }),
      );

      setLastOrder(result.order);

      if (method === "paystack" || method === "card") {
        const callbackUrl = `${window.location.origin}/payments/callback?order=${encodeURIComponent(result.order.orderNumber ?? result.order.id)}`;
        const init = await initializePaystackPayment({
          orderId: result.order.id,
          callbackUrl,
        });
        if (!init.ok) {
          setError(init.reason);
          toastError("Payment setup failed", init.reason);
          router.push(
            `/payments/failed?order=${encodeURIComponent(result.order.orderNumber ?? result.order.id)}&reason=${encodeURIComponent(init.reason)}`,
          );
          return;
        }
        if (!init.authorizationUrl) {
          const reason = "Paystack did not return a checkout URL.";
          setError(reason);
          toastError("Payment setup failed", reason);
          return;
        }
        console.log(
          JSON.stringify({
            payment: {
              at: new Date().toISOString(),
              stage: "init.redirect",
              message: "Redirecting to Paystack authorization_url",
              orderId: init.orderId,
              reference: init.reference,
            },
          }),
        );
        toastSuccess("Redirecting to Paystack");
        window.location.assign(init.authorizationUrl);
        return;
      }

      if (method === "korapay") {
        const callbackUrl = `${window.location.origin}/payments/callback?order=${encodeURIComponent(result.order.orderNumber ?? result.order.id)}`;
        const init = await initializeKorapayPayment({
          orderId: result.order.id,
          callbackUrl,
        });
        if (!init.ok) {
          setError(init.reason);
          toastError("Payment setup failed", init.reason);
          router.push(
            `/payments/failed?order=${encodeURIComponent(result.order.orderNumber ?? result.order.id)}&reason=${encodeURIComponent(init.reason)}`,
          );
          return;
        }
        if (!init.authorizationUrl) {
          const reason = "KoraPay did not return a checkout URL.";
          setError(reason);
          toastError("Payment setup failed", reason);
          return;
        }
        console.log(
          JSON.stringify({
            payment: {
              at: new Date().toISOString(),
              stage: "init.redirect",
              message: "Redirecting to KoraPay checkout_url",
              orderId: init.orderId,
              reference: init.reference,
            },
          }),
        );
        toastSuccess("Redirecting to KoraPay");
        window.location.assign(init.authorizationUrl);
        return;
      }

      if (method === "squad") {
        const init = await initializeSquadPayment({ orderId: result.order.id });
        if (!init.ok) {
          setError(init.reason);
          toastError("Payment setup failed", init.reason);
          router.push(
            `/payments/failed?order=${encodeURIComponent(result.order.orderNumber ?? result.order.id)}&reason=${encodeURIComponent(init.reason)}`,
          );
          return;
        }
        toastSuccess("Redirecting to Squad");
        window.location.assign(init.authorizationUrl);
        return;
      }
      if (method === "monnify") {
        const init = await initializeMonnifyPayment({
          orderId: result.order.id,
        });
        if (!init.ok) {
          setError(init.reason);
          toastError("Payment setup failed", init.reason);
          router.push(
            `/payments/failed?order=${encodeURIComponent(result.order.orderNumber ?? result.order.id)}&reason=${encodeURIComponent(init.reason)}`,
          );
          return;
        }
        toastSuccess("Redirecting to Monnify");
        window.location.assign(init.authorizationUrl);
        return;
      }
      if (method === "bachs") {
        const init = await initializeBachsPayment({ orderId: result.order.id });
        if (!init.ok) {
          setError(init.reason);
          toastError("Payment setup failed", init.reason);
          router.push(
            `/payments/failed?order=${encodeURIComponent(result.order.orderNumber ?? result.order.id)}&reason=${encodeURIComponent(init.reason)}`,
          );
          return;
        }
        toastSuccess("Redirecting to Bachs");
        window.location.assign(init.authorizationUrl);
        return;
      }

      if (method === "cash-on-delivery") {
        const init = await initializeCodCommitmentFeePayment({
          orderId: result.order.id,
          gateway: codFeeGateway,
        });
        if (!init.ok) {
          setError(init.reason);
          toastError("Commitment fee setup failed", init.reason);
          router.push(
            `/payments/failed?order=${encodeURIComponent(result.order.orderNumber ?? result.order.id)}&reason=${encodeURIComponent(init.reason)}`,
          );
          return;
        }
        if (!init.authorizationUrl) {
          const reason = "The payment gateway did not return a checkout URL.";
          setError(reason);
          toastError("Payment setup failed", reason);
          return;
        }
        toastSuccess("Redirecting to payment", "Pay the 25% commitment fee");
        window.location.assign(init.authorizationUrl);
        return;
      }

      setError("Unsupported payment method.");
    } catch {
      setError("Network error while placing your order. Please try again.");
      toastError("Order failed", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="sb-container py-16 text-center text-sm text-muted">
        Loading checkout…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="sb-container">
        <PageHeader
          crumbs={[
            { label: "Home", href: "/" },
            { label: "Cart", href: "/cart" },
            { label: "Checkout" },
          ]}
          title="Checkout"
          description="Your cart is empty."
        />
        <EmptyState
          illustration={<EmptyCartIllustration />}
          title="Nothing to check out"
          description="Add products to your cart before placing an order."
          actions={<ButtonLink href="/products">Browse products</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Cart", href: "/cart" },
          { label: "Checkout" },
        ]}
        title="Checkout"
        description="Complete your details and choose an available payment method. Your order remains pending until payment is verified securely by our server."
      />

      <ol className="mb-8 flex items-center gap-2 overflow-x-auto no-scrollbar sm:gap-4">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="flex shrink-0 items-center gap-2 sm:gap-4"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={
                  step.state === "done"
                    ? "grid h-8 w-8 place-items-center rounded-full bg-primary text-white"
                    : step.state === "current"
                      ? "grid h-8 w-8 place-items-center rounded-full border-2 border-primary bg-white text-[13px] font-semibold text-primary"
                      : "grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-[13px] font-medium text-muted"
                }
              >
                {step.state === "done" ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={
                  step.state === "upcoming"
                    ? "text-[13px] text-muted"
                    : "text-[13px] font-medium text-ink"
                }
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span className="h-px w-8 bg-line sm:w-16" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-6">
          <Card>
            <h2 className="text-[15px] font-semibold text-ink">
              Customer & shipping address
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="first-name">First name</Label>
                <Input
                  id="first-name"
                  value={customer.firstName}
                  onChange={(event) =>
                    setCustomer({ firstName: event.target.value })
                  }
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="last-name">Last name</Label>
                <Input
                  id="last-name"
                  value={customer.lastName}
                  onChange={(event) =>
                    setCustomer({ lastName: event.target.value })
                  }
                  placeholder="Last name"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customer.email}
                  onChange={(event) =>
                    setCustomer({ email: event.target.value })
                  }
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customer.phone}
                  onChange={(event) =>
                    setCustomer({ phone: event.target.value })
                  }
                  placeholder="+234 801 234 5678"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="street">Street address</Label>
                <Input
                  id="street"
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                  placeholder="Street address"
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={stateName}
                  onChange={(event) => setStateName(event.target.value)}
                  placeholder="State"
                />
              </div>
              <div>
                <Label htmlFor="postcode">Postal code</Label>
                <Input
                  id="postcode"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  placeholder="Postal code"
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  id="country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                >
                  <option>Nigeria</option>
                  <option>Ghana</option>
                  <option>Kenya</option>
                  <option>United Kingdom</option>
                  <option>United States</option>
                </Select>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-[15px] font-semibold text-ink">
              Delivery notes
            </h2>
            <div className="mt-5">
              <Label htmlFor="instructions" hint="Optional">
                Delivery instructions
              </Label>
              <Textarea
                id="instructions"
                value={deliveryNotes}
                onChange={(event) => setDeliveryNotes(event.target.value)}
                placeholder="Gate code, floor, or where to leave the parcel if you are out."
              />
            </div>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Truck className="h-[18px] w-[18px] text-primary" aria-hidden />
              Shipping method
            </h2>
            <div className="mt-5 space-y-3">
              {DELIVERY_OPTIONS.map((option) => {
                const fee =
                  storeSettings?.deliveryOptions?.find(
                    (entry) => entry.id === option.id,
                  )?.fee ?? deliveryFeeFor(option.id, subtotal);
                return (
                  <Radio
                    key={option.id}
                    name="shipping"
                    checked={deliveryOptionId === option.id}
                    onChange={() =>
                      setDeliveryOptionId(option.id as DeliveryOptionId)
                    }
                    label={`${option.label}${fee > 0 ? ` — ${formatPrice(fee)}` : fee === 0 ? " — free" : ""}`}
                    description={option.estimatedDays}
                  />
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <CreditCard
                className="h-[18px] w-[18px] text-primary"
                aria-hidden
              />
              Payment method
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Pay securely with your preferred payment method.
            </p>
            <div className="mt-5 space-y-3">
              <PaymentProviderOptions
                selectedProvider={paymentMethod}
                onSelectProvider={setPaymentMethod}
                deliveryState={stateName}
                commitmentFee={Math.ceil(total * 0.25)}
              />
              {paymentMethod === "cash-on-delivery" ? (
                <div className="ml-8 space-y-2">
                  <Label htmlFor="cod-fee-gateway">
                    Pay the commitment fee with
                  </Label>
                  <Select
                    id="cod-fee-gateway"
                    value={codFeeGateway}
                    onChange={(event) =>
                      setCodFeeGateway(event.target.value as CodFeeGateway)
                    }
                  >
                    {codFeeGateways.paystack && (
                      <option value="paystack">Paystack</option>
                    )}
                    {codFeeGateways.korapay && (
                      <option value="korapay">KoraPay</option>
                    )}
                    {codFeeGateways.squad && (
                      <option value="squad">Squad by GTBank</option>
                    )}
                    {codFeeGateways.monnify && (
                      <option value="monnify">Monnify</option>
                    )}
                    {codFeeGateways.bachs && (
                      <option value="bachs">Bachs</option>
                    )}
                  </Select>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <Card padded={false}>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-semibold text-ink">
                Order items ({items.length})
              </h2>
            </div>
            <ul className="divide-y divide-line px-5">
              {items.map((line) => (
                <li
                  key={`${line.productId}-${line.variation ?? ""}`}
                  className="flex items-center gap-3 py-4"
                >
                  <ProductMedia
                    icon={line.icon}
                    tone={line.tone}
                    name={line.name}
                    src={line.thumbnail}
                    className="h-14 w-14 shrink-0"
                    iconClassName="h-2/5 w-2/5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {line.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      Qty {line.quantity}
                      {line.variation ? ` · ${line.variation}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold text-ink">
                    {formatPrice(line.price * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <OrderSummary
            subtotal={subtotal}
            shipping={shipping}
            discount={couponDiscount}
            couponCode={couponCode}
            couponHint={couponHint}
            withCoupon
            onApplyCoupon={async (code) => {
              if (!code) {
                setCouponCode("");
                setCouponDiscount(0);
                setCouponHint(null);
                return;
              }
              const result = await applyCouponCode(code, subtotal);
              if (!result.ok) {
                setCouponCode(code);
                setCouponDiscount(0);
                setCouponHint({ tone: "error", message: result.reason });
                toastError("Coupon not applied", result.reason);
                return;
              }
              setCouponCode(result.coupon.code);
              setCouponDiscount(result.discount);
              setCouponHint({ tone: "success", message: result.message });
              toastSuccess("Coupon applied", result.message);
            }}
            footer={
              <>
                {error ? (
                  <p className="mb-3 text-[13px] text-primary" role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handlePlaceOrder}
                  className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-primary px-7 text-[15px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(20,92,67,0.35)] transition-all duration-200 ease-premium hover:bg-primary-600 active:scale-[0.985] disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" aria-hidden />
                  {submitting
                    ? paymentMethod === "paystack" || paymentMethod === "card"
                      ? "Redirecting to Paystack…"
                      : paymentMethod === "korapay"
                        ? "Redirecting to KoraPay…"
                        : paymentMethod === "squad"
                          ? "Redirecting to Squad…"
                          : paymentMethod === "monnify"
                            ? "Redirecting to Monnify…"
                            : paymentMethod === "bachs"
                              ? "Redirecting to Bachs…"
                              : "Placing order…"
                    : paymentMethod === "paystack" || paymentMethod === "card"
                      ? "Pay with Paystack"
                      : paymentMethod === "korapay"
                        ? "Pay with KoraPay"
                        : paymentMethod === "squad"
                          ? "Pay with Squad"
                          : paymentMethod === "monnify"
                            ? "Pay with Monnify"
                            : paymentMethod === "bachs"
                              ? "Pay with Bachs"
                              : paymentMethod === "flutterwave"
                                ? "Pay with Flutterwave"
                                : "Place order"}
                </button>
                <p className="mt-4 text-center text-[12px] leading-relaxed text-muted">
                  By placing this order you agree to the Zenvexa terms of
                  service and returns policy.
                </p>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
