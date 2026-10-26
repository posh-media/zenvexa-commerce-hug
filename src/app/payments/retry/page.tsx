"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { getOrderByNumber } from "@/services/orders.service";
import { 
  initializeCodCommitmentFeePayment,
  initializePaystackPayment, 
  initializeKorapayPayment,
  initializeSquadPayment,
  initializeMonnifyPayment,
  getPaymentProviderSettings,
  type CodFeeGateway
} from "@/services/payments.service";
import { toastError, toastSuccess } from "@/stores/toast.store";
import type { Order } from "@/types/order";
import { formatPrice } from "@/lib/utils";

function PaymentRetryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderParam = searchParams.get("order") || "";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [providers, setProviders] = useState<{
    monnify: boolean;
    squad: boolean;
    paystack: boolean;
    korapay: boolean;
    flutterwave: boolean;
    cod: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!orderParam) {
        setError("Missing order reference.");
        setLoading(false);
        return;
      }
      try {
        const found = await getOrderByNumber(orderParam);
        if (!active) return;
        if (!found) {
          setError("We could not find that order.");
          setLoading(false);
          return;
        }
        if (
          found.paymentStatus === "paid" ||
          (String(found.paymentMethod ?? "") === "cash-on-delivery" &&
            found.commitmentFeeStatus === "paid")
        ) {
          router.replace(
            `/order-success?order=${encodeURIComponent(found.orderNumber ?? found.id)}`,
          );
          return;
        }
        setOrder(found);
        
        // Load payment providers and auto-select first available
        if (!selectedProvider) {
          const settings = await getPaymentProviderSettings();
          setProviders(settings);
          
          if (String(found.paymentMethod ?? "") === "cash-on-delivery") {
            // COD orders retry the 25% commitment fee, not the full total.
            const prev = String(found.paymentGateway ?? "");
            if (["paystack", "korapay", "squad", "monnify"].includes(prev)) {
              setSelectedProvider(prev);
            } else if (settings.paystack) {
              setSelectedProvider("paystack");
            } else if (settings.korapay) {
              setSelectedProvider("korapay");
            } else if (settings.squad) {
              setSelectedProvider("squad");
            } else if (settings.monnify) {
              setSelectedProvider("monnify");
            }
          } else if (found.paymentMethod === "monnify") {
            if (settings.monnify) setSelectedProvider("monnify");
            else setError("Monnify is currently unavailable. Please contact support about this order.");
          } else if (found.paymentMethod === "squad") {
            if (settings.squad) setSelectedProvider("squad");
            else setError("Squad is currently unavailable. Please contact support about this order.");
          } else if (settings.paystack) {
            setSelectedProvider("paystack");
          } else if (settings.korapay) {
            setSelectedProvider("korapay");
          } else if (settings.flutterwave) {
            setSelectedProvider("flutterwave");
          } else if (settings.cod) {
            setSelectedProvider("cash-on-delivery");
          }
        }
      } catch {
        if (active) setError("Could not load this order.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [orderParam, router, selectedProvider]);

  const onRetry = async () => {
    if (!order || !selectedProvider) return;
    setSubmitting(true);
    setError(null);
    try {
      const callbackUrl = `${window.location.origin}/payments/callback?order=${encodeURIComponent(order.orderNumber ?? order.id)}`;
      const isCodFee = String(order.paymentMethod ?? "") === "cash-on-delivery";
      let init;
      
      if (isCodFee) {
        if (!["paystack", "korapay", "squad", "monnify"].includes(selectedProvider)) {
          setError("Select an online payment method for the commitment fee.");
          setSubmitting(false);
          return;
        }
        init = await initializeCodCommitmentFeePayment({
          orderId: order.id,
          gateway: selectedProvider as CodFeeGateway,
        });
      } else if (selectedProvider === "monnify") {
        init = await initializeMonnifyPayment({ orderId: order.id });
      } else if (selectedProvider === "squad") {
        init = await initializeSquadPayment({ orderId: order.id });
      } else if (selectedProvider === "paystack") {
        init = await initializePaystackPayment({
          orderId: order.id,
          callbackUrl,
        });
      } else if (selectedProvider === "korapay") {
        init = await initializeKorapayPayment({
          orderId: order.id,
          callbackUrl,
        });
      } else {
        setError("Selected payment method is not available.");
        setSubmitting(false);
        return;
      }
      
      if (!init.ok) {
        setError(init.reason);
        toastError("Could not start payment", init.reason);
        return;
      }
      
      const providerName = selectedProvider === "monnify" ? "Monnify" : selectedProvider === "squad" ? "Squad" : selectedProvider === "paystack" ? "Paystack" :
                          selectedProvider === "korapay" ? "KoraPay" : 
                          selectedProvider === "flutterwave" ? "Flutterwave" : "payment";
      toastSuccess(`Redirecting to ${providerName}`);
      window.location.href = init.authorizationUrl;
    } catch {
      setError("Network error while starting payment.");
      toastError("Payment failed", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Checkout", href: "/checkout" },
          { label: "Retry payment" },
        ]}
        title="Retry payment"
        description="Complete Paystack checkout for your pending order. Stock is only reduced after successful payment."
      />

      <Card className="mx-auto max-w-lg">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading order…
          </div>
        ) : error && !order ? (
          <div className="space-y-4 text-center">
            <p className="text-[14px] text-primary" role="alert">
              {error}
            </p>
            <ButtonLink href="/checkout">Go to checkout</ButtonLink>
          </div>
        ) : order ? (
          <div className="space-y-5">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
                Pending order
              </p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {order.orderNumber ?? order.id}
              </p>
              <p className="mt-1 text-[14px] text-muted">
                Total{" "}
                <span className="font-semibold text-ink">
                  {formatPrice(Number(order.total ?? 0))}
                </span>
              </p>
              <p className="mt-1 text-[13px] text-muted">
                Payment status: {order.paymentStatus ?? "pending"}
              </p>
              {String(order.paymentMethod ?? "") === "cash-on-delivery" &&
              order.codCommitmentFee !== undefined ? (
                <p className="mt-2 rounded-lg bg-soft/60 px-3 py-2 text-[13px] text-muted">
                  Cash on delivery — the 25% commitment fee{" "}
                  <span className="font-semibold text-ink">
                    ({formatPrice(order.codCommitmentFee)})
                  </span>{" "}
                  must be paid online before this order is confirmed. You pay
                  the remaining{" "}
                  {formatPrice(
                    Number(order.total ?? 0) - Number(order.codCommitmentFee),
                  )}{" "}
                  on delivery.
                </p>
              ) : null}
            </div>
            {error ? (
              <p className="text-[13px] text-primary" role="alert">
                {error}
              </p>
            ) : null}
            {providers && (
              <div className="space-y-3">
                <p className="text-[13px] font-medium text-ink">Payment method</p>
                <div className="space-y-2">
                  {providers.paystack && !["squad", "monnify"].includes(order?.paymentMethod ?? "") && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="provider"
                        value="paystack"
                        checked={selectedProvider === "paystack"}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="h-4 w-4 text-primary"
                      />
                      <span className="text-[13px]">Paystack</span>
                    </label>
                  )}
                  {providers.korapay && !["squad", "monnify"].includes(order?.paymentMethod ?? "") && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="provider"
                        value="korapay"
                        checked={selectedProvider === "korapay"}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="h-4 w-4 text-primary"
                      />
                      <span className="text-[13px]">KoraPay</span>
                    </label>
                  )}
                  {providers.squad && (order?.paymentMethod === "squad" || order?.paymentMethod === "cash-on-delivery") && (
                    <label className="flex items-center gap-2">
                      <input type="radio" name="provider" value="squad"
                        checked={selectedProvider === "squad"}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="h-4 w-4 text-primary" />
                      <span className="text-[13px]">Squad by GTBank</span>
                    </label>
                  )}
                  {providers.monnify && (order?.paymentMethod === "monnify" || order?.paymentMethod === "cash-on-delivery") && (
                    <label className="flex items-center gap-2">
                      <input type="radio" name="provider" value="monnify"
                        checked={selectedProvider === "monnify"}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="h-4 w-4 text-primary" />
                      <span className="text-[13px]">Monnify</span>
                    </label>
                  )}
                  {providers.flutterwave && !["squad", "monnify", "cash-on-delivery"].includes(order?.paymentMethod ?? "") && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="provider"
                        value="flutterwave"
                        checked={selectedProvider === "flutterwave"}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="h-4 w-4 text-primary"
                      />
                      <span className="text-[13px]">Flutterwave</span>
                    </label>
                  )}
                  {providers.cod && !["squad", "monnify", "cash-on-delivery"].includes(order?.paymentMethod ?? "") && (
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="provider"
                        value="cash-on-delivery"
                        checked={selectedProvider === "cash-on-delivery"}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="h-4 w-4 text-primary"
                      />
                      <span className="text-[13px]">Cash on delivery</span>
                    </label>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                disabled={submitting || !selectedProvider}
                onClick={onRetry}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                {submitting 
                  ? "Starting payment…" 
                  : selectedProvider === "squad"
                    ? "Pay with Squad"
                    : selectedProvider === "monnify"
                      ? "Pay with Monnify"
                  : selectedProvider === "paystack"
                    ? "Pay with Paystack"
                    : selectedProvider === "korapay"
                      ? "Pay with KoraPay"
                      : selectedProvider === "flutterwave"
                        ? "Pay with Flutterwave"
                        : "Place order"}
              </Button>
              <ButtonLink href="/cart" variant="outline" size="lg">
                View cart
              </ButtonLink>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export default function PaymentRetryPage() {
  return (
    <Suspense fallback={null}>
      <PaymentRetryContent />
    </Suspense>
  );
}
