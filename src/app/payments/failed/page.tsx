"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { verifyPaystackPayment, verifyKorapayPayment } from "@/services/payments.service";
import { toastError, toastSuccess } from "@/stores/toast.store";

function PaymentFailedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const order = searchParams.get("order") || "";
  const reference = searchParams.get("reference") || "";
  const [verifying, setVerifying] = useState(false);
  const reason =
    searchParams.get("reason") ||
    "We could not confirm this payment. Your cart was not cleared.";

  const retryHref = order
    ? `/payments/retry?order=${encodeURIComponent(order)}`
    : "/checkout";

  const handleManualVerify = async () => {
    if (!reference || verifying) return;
    
    setVerifying(true);
    
    // Add diagnostic logging
    console.log("[ManualVerify] Starting verification", {
      reference,
      order,
      hasReference: Boolean(reference),
      hasOrder: Boolean(order),
    });
    
    try {
      // Try Paystack first, then KoraPay
      let result = await verifyPaystackPayment(reference);
      if (!result.ok) {
        console.log("[ManualVerify] Paystack verification failed", {
          reference,
          reason: result.reason,
        });
        try {
          result = await verifyKorapayPayment(reference);
          console.log("[ManualVerify] KoraPay verification result", {
            reference,
            ok: result.ok,
            reason: result.ok ? "success" : result.reason,
          });
        } catch (error) {
          console.log("[ManualVerify] KoraPay verification error", {
            reference,
            error: error instanceof Error ? error.message : "unknown",
          });
          // KoraPay also failed, stick with Paystack result
        }
      }
      
      if (result.ok) {
        const orderNumber = result.order.orderNumber || order || result.order.id;
        console.log("[ManualVerify] Verification successful", { orderNumber });
        toastSuccess("Payment verified", `Order ${orderNumber}`);
        router.push(`/track-order?order=${encodeURIComponent(orderNumber)}`);
        return;
      }
      
      console.log("[ManualVerify] Verification failed", {
        reference,
        reason: result.reason,
      });
      toastError("Verification failed", result.reason || "Payment could not be confirmed");
    } catch (error) {
      console.log("[ManualVerify] Verification exception", {
        reference,
        error: error instanceof Error ? error.message : "unknown",
      });
      toastError("Verification failed", "Please try again shortly");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Checkout", href: "/checkout" },
          { label: "Payment failed" },
        ]}
        title="Payment failed"
        description="No charge was completed for this attempt, or verification did not succeed."
      />
      <Card className="mx-auto max-w-lg text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-50 text-primary">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-ink">
          We couldn&apos;t complete payment
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{reason}</p>
        {order ? (
          <p className="mt-3 text-[13px] text-muted">
            Order <span className="font-medium text-ink">{order}</span> is still
            pending — you can retry without losing your cart items.
          </p>
        ) : null}
        {reference ? (
          <p className="mt-1 text-[12px] text-muted">Reference: {reference}</p>
        ) : null}
        
        {reference && (
          <div className="mt-6 border-t border-line pt-6">
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
                  const body = encodeURIComponent(
                    `Dear Support Team,\n\n` +
                    `I am writing to report a payment verification issue.\n\n` +
                    `Transaction Details:\n` +
                    `Order ID: ${order || 'N/A'}\n` +
                    `Transaction Reference: ${reference}\n` +
                    `Payment Provider: KoraPay\n` +
                    `Transaction Status: ${reason}\n\n` +
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
        
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href={retryHref} size="lg">
            Retry payment
          </ButtonLink>
          <ButtonLink href="/checkout" variant="outline" size="lg">
            Back to checkout
          </ButtonLink>
          <ButtonLink href="/cart" variant="ghost" size="lg">
            View cart
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={null}>
      <PaymentFailedContent />
    </Suspense>
  );
}
