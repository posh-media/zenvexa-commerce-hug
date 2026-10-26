"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyPaystackPayment, verifyKorapayPayment, verifySquadPayment, verifyMonnifyPayment } from "@/services/payments.service";
import {
  getOrderByNumber,
  watchOrderUntilPaid,
} from "@/services/orders.service";
import { useCartStore } from "@/stores/cart.store";
import { useCheckoutStore } from "@/stores/checkout.store";
import { toastError, toastSuccess } from "@/stores/toast.store";

function clientLog(stage: string, message: string, meta?: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      payment: { at: new Date().toISOString(), stage, message, ...meta },
    }),
  );
}

function PaymentCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clearCart = useCartStore((state) => state.clear);
  const setLastOrder = useCheckoutStore((state) => state.setLastOrder);
  const [message, setMessage] = useState("Confirming your payment…");
  const [verifying, setVerifying] = useState(false);
  const [showManualVerify, setShowManualVerify] = useState(false);

  const handleManualVerify = async () => {
    const reference = searchParams.get("reference") || searchParams.get("trxref") || (searchParams.get("provider") === "monnify" ? searchParams.get("paymentReference") : "") || "";
    const orderParam = searchParams.get("order") || "";
    
    if (!reference || verifying) return;
    
    setVerifying(true);
    setMessage("Verifying payment manually…");
    
    clientLog("manual_verify.start", "Starting manual verification", {
      reference,
      orderParam,
      hasReference: Boolean(reference),
      hasOrderParam: Boolean(orderParam),
    });
    
    try {
      // Route Squad and Monnify directly; preserve Paystack/KoraPay fallback for existing callbacks.
      let result = searchParams.get("provider") === "squad"
        ? await verifySquadPayment(reference)
        : searchParams.get("provider") === "monnify"
          ? await verifyMonnifyPayment(reference)
        : await verifyPaystackPayment(reference);
      if (!result.ok && !["squad", "monnify"].includes(searchParams.get("provider") ?? "")) {
        clientLog("manual_verify.paystack_failed", "Paystack verification failed", {
          reference,
          reason: result.reason,
        });
        try {
          result = await verifyKorapayPayment(reference);
          clientLog("manual_verify.korapay_result", "KoraPay verification result", {
            reference,
            ok: result.ok,
            reason: result.ok ? "success" : result.reason,
          });
        } catch (error) {
          clientLog("manual_verify.korapay_error", "KoraPay verification error", {
            reference,
            error: error instanceof Error ? error.message : "unknown",
          });
          // KoraPay also failed, stick with Paystack result
        }
      }
      
      if (result.ok) {
        const orderNumber = result.order.orderNumber || orderParam || result.order.id;
        clearCart();
        const fullOrder = await getOrderByNumber(orderNumber).catch(() => undefined);
        if (fullOrder) setLastOrder(fullOrder);
        clientLog("manual_verify.success", "Manual verification successful", { orderNumber });
        toastSuccess("Payment verified", `Order ${orderNumber}`);
        router.replace(`/track-order?order=${encodeURIComponent(orderNumber)}`);
        return;
      }
      
      clientLog("manual_verify.failed", "Manual verification failed", {
        reference,
        reason: result.reason,
      });
      setMessage("Payment could not be confirmed yet. Please try again shortly.");
      toastError("Verification failed", result.reason || "Payment could not be confirmed");
    } catch (error) {
      clientLog("manual_verify.exception", "Manual verification exception", {
        reference,
        error: error instanceof Error ? error.message : "unknown",
      });
      setMessage("Verification failed. Please try again shortly.");
      toastError("Verification failed", "Please try again shortly");
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const cancelled = searchParams.get("cancelled");
    const reference =
      searchParams.get("reference") || searchParams.get("trxref") || (searchParams.get("provider") === "monnify" ? searchParams.get("paymentReference") : "") || "";
    const orderParam = searchParams.get("order") || "";

    clientLog("callback.start", "Payment callback loaded", {
      orderParam,
      hasReference: Boolean(reference),
      cancelled,
    });

    if (cancelled === "1") {
      const query = new URLSearchParams();
      if (orderParam) query.set("order", orderParam);
      if (reference) query.set("reference", reference);
      router.replace(`/payments/cancelled?${query.toString()}`);
      return;
    }

    let active = true;

    const goSuccess = async (orderNumber: string) => {
      if (!active) return;
      clearCart();
      const fullOrder = await getOrderByNumber(orderNumber).catch(() => undefined);
      if (fullOrder) setLastOrder(fullOrder);
      clientLog("callback.success", "Navigating to order success", {
        orderNumber,
      });
      toastSuccess("Payment successful", `Order ${orderNumber}`);
      router.replace(
        `/order-success?order=${encodeURIComponent(orderNumber)}`,
      );
    };

    const goFailed = (reason: string) => {
      if (!active) return;
      clientLog("callback.failure", reason, { orderParam, reference });
      toastError("Payment not confirmed", reason);
      const query = new URLSearchParams();
      if (orderParam) query.set("order", orderParam);
      if (reference) query.set("reference", reference);
      query.set("reason", reason);
      router.replace(`/payments/failed?${query.toString()}`);
    };

    // Show manual verify button after 6 seconds if still processing
    const manualVerifyTimeout = setTimeout(() => {
      if (active) setShowManualVerify(true);
    }, 6000);

    void (async () => {
      // 1) Best-effort server verify (needs Firebase Admin on the Next server).
      if (reference) {
        setMessage("Verifying payment…");
        try {
          clientLog("callback.verify", "Calling verify API", { reference });
          // Route Squad and Monnify directly; preserve Paystack/KoraPay fallback for existing callbacks.
          let result = searchParams.get("provider") === "squad"
            ? await verifySquadPayment(reference)
            : searchParams.get("provider") === "monnify"
              ? await verifyMonnifyPayment(reference)
              : await verifyPaystackPayment(reference);
          if (!result.ok && !["squad", "monnify"].includes(searchParams.get("provider") ?? "")) {
            // Try KoraPay if Paystack fails
            try {
              result = await verifyKorapayPayment(reference);
            } catch {
              // KoraPay also failed, stick with Paystack result
            }
          }
          if (!active) return;
          if (result.ok) {
            const orderNumber =
              result.order.orderNumber || orderParam || result.order.id;
            await goSuccess(orderNumber);
            return;
          }
          clientLog("callback.verify", "Verify API did not confirm yet", {
            reason: result.reason,
          });
        } catch (error) {
          clientLog("callback.verify", "Verify API unavailable — watching Firestore", {
            message: error instanceof Error ? error.message : "unknown",
          });
        }
      } else if (!orderParam) {
        goFailed("Missing payment reference.");
        return;
      }

      // 2) Firestore listener / poll — webhook CF marks the order paid.
      if (!orderParam && !reference) {
        goFailed("Missing payment reference.");
        return;
      }

      setMessage("Waiting for payment confirmation…");
      clientLog("callback.listener", "Watching order for paymentStatus=paid", {
        orderParam,
        reference,
      });

      const paidOrder = await watchOrderUntilPaid(orderParam || reference, {
        timeoutMs: 120_000,
        onUpdate: (order) => {
          if (!active) return;
          setMessage(
            order.paymentStatus === "paid"
              ? "Payment confirmed — redirecting…"
              : `Status: ${order.paymentStatus ?? "pending"}…`,
          );
        },
      });

      if (!active) return;

      if (
        paidOrder?.paymentStatus === "paid" ||
        (String(paidOrder?.paymentMethod ?? "") === "cash-on-delivery" &&
          paidOrder?.commitmentFeeStatus === "paid")
      ) {
        await goSuccess(paidOrder.orderNumber ?? paidOrder.id);
        return;
      }

      // 3) One more verify attempt if we have a reference.
      if (reference) {
        try {
          let result = searchParams.get("provider") === "monnify"
            ? await verifyMonnifyPayment(reference)
            : searchParams.get("provider") === "squad"
              ? await verifySquadPayment(reference)
              : await verifyPaystackPayment(reference);
          if (!result.ok && !["squad", "monnify"].includes(searchParams.get("provider") ?? "")) {
            try {
              result = await verifyKorapayPayment(reference);
            } catch {
              // KoraPay also failed, stick with Paystack result
            }
          }
          if (!active) return;
          if (result.ok) {
            await goSuccess(
              result.order.orderNumber || orderParam || result.order.id,
            );
            return;
          }
        } catch {
          /* ignore */
        }
      }

      goFailed(
        "Payment is still pending. If you were charged, wait a moment and open Track order, or retry payment.",
      );
    })();

    return () => {
      clearTimeout(manualVerifyTimeout);
      active = false;
    };
  }, [clearCart, router, searchParams, setLastOrder]);

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Checkout", href: "/checkout" },
          { label: "Payment" },
        ]}
        title="Processing payment"
        description="Please wait while we confirm your Paystack payment."
      />
      <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-[15px] text-ink">{message}</p>
        <p className="text-[13px] text-muted">
          Do not close this window. You will be redirected automatically when
          payment is confirmed.
        </p>
        
        {showManualVerify && (
          <div className="mt-6 border-t border-line pt-6 w-full">
            <p className="text-[13px] text-muted mb-3">
              Confirmation taking too long?
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleManualVerify}
                disabled={verifying}
                variant="outline"
                size="sm"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying payment...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Verify manually
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const subject = encodeURIComponent("To Support - Payment Verification");
                  const orderParam = searchParams.get("order") || "";
                  const referenceParam = searchParams.get("reference") || searchParams.get("trxref") || (searchParams.get("provider") === "monnify" ? searchParams.get("paymentReference") : "") || "";
                  const body = encodeURIComponent(
                    `Dear Support Team,\n\n` +
                    `I am writing to report a payment verification issue.\n\n` +
                    `Transaction Details:\n` +
                    `Order ID: ${orderParam || 'N/A'}\n` +
                    `Transaction Reference: ${referenceParam}\n` +
                    `Payment Provider: KoraPay\n` +
                    `Transaction Status: ${message}\n\n` +
                    `Additional Information:\n` +
                    `Please provide any additional details about your issue here.\n\n` +
                    `Thank you,\n` +
                    `Customer`
                  );
                  window.open(`mailto:support@shopbeta.ng?subject=${subject}&body=${body}`);
                }}
              >
                Contact Support
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="sb-container py-16 text-center text-sm text-muted">
          Loading…
        </div>
      }
    >
      <PaymentCallbackContent />
    </Suspense>
  );
}
