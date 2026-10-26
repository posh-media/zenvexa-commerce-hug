"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Ban } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

function PaymentCancelledContent() {
  const searchParams = useSearchParams();
  const order = searchParams.get("order") || "";
  const reference = searchParams.get("reference") || "";
  const retryHref = order
    ? `/payments/retry?order=${encodeURIComponent(order)}`
    : "/checkout";

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Checkout", href: "/checkout" },
          { label: "Payment cancelled" },
        ]}
        title="Payment cancelled"
        description="You left Paystack before completing payment. Your cart is unchanged."
      />
      <Card className="mx-auto max-w-lg text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-soft text-muted">
          <Ban className="h-7 w-7" aria-hidden />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-ink">
          Payment was cancelled
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          No money was taken. You can retry payment for this order whenever you
          are ready.
        </p>
        {order ? (
          <p className="mt-3 text-[13px] text-muted">
            Pending order: <span className="font-medium text-ink">{order}</span>
          </p>
        ) : null}
        {reference ? (
          <p className="mt-1 text-[12px] text-muted">Reference: {reference}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href={retryHref} size="lg">
            Retry payment
          </ButtonLink>
          <ButtonLink href="/cart" variant="outline" size="lg">
            Return to cart
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

export default function PaymentCancelledPage() {
  return (
    <Suspense fallback={null}>
      <PaymentCancelledContent />
    </Suspense>
  );
}
