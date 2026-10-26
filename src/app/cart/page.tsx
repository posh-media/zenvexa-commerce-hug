"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Tag, Truck } from "lucide-react";
import {
  cartItemCount,
  cartSubtotal,
  FREE_DELIVERY_THRESHOLD,
} from "@/lib/cart";
import { applyCouponCode } from "@/lib/coupons";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyCartIllustration } from "@/components/ui/illustrations";
import { CartItemRow } from "@/components/commerce/cart-item";
import { OrderSummary } from "@/components/commerce/order-summary";
import { useCartStore } from "@/stores/cart.store";
import { useCheckoutStore } from "@/stores/checkout.store";
import { toastError, toastSuccess } from "@/stores/toast.store";

export default function CartPage() {
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state.hydrated);
  const clear = useCartStore((state) => state.clear);
  const setCouponDiscount = useCheckoutStore((state) => state.setCouponDiscount);
  const setCouponCode = useCheckoutStore((state) => state.setCouponCode);
  const couponDiscount = useCheckoutStore((state) => state.couponDiscount);
  const couponCode = useCheckoutStore((state) => state.couponCode);
  const [couponHint, setCouponHint] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const count = cartItemCount(items);
  const subtotal = cartSubtotal(items);
  const qualifiesFree =
    subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0;

  if (!hydrated) {
    return (
      <div className="sb-container py-16 text-center text-sm text-muted">
        Loading cart…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="sb-container">
        <PageHeader
          crumbs={[{ label: "Home", href: "/" }, { label: "Cart" }]}
          title="Shopping cart"
          description="Your cart is empty."
        />
        <EmptyState
          illustration={<EmptyCartIllustration />}
          title="Your cart is empty"
          description="Browse the catalogue and add products to start checkout."
          actions={
            <>
              <ButtonLink href="/products">Browse products</ButtonLink>
              <ButtonLink href="/deals" variant="outline">
                See today&apos;s deals
              </ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Cart" }]}
        title="Shopping cart"
        description={`${count} item${count === 1 ? "" : "s"} ready to check out. Delivery and taxes are calculated at the next step.`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
        <div className="space-y-6">
          {qualifiesFree ? (
            <Alert tone="success" title="You qualify for free delivery">
              Orders over {formatPrice(FREE_DELIVERY_THRESHOLD)} ship free on
              express delivery.
            </Alert>
          ) : (
            <Alert tone="info" title="Almost there">
              Add {formatPrice(FREE_DELIVERY_THRESHOLD - subtotal)} more for free
              express delivery.
            </Alert>
          )}

          <Card padded={false}>
            <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
              <h2 className="text-[15px] font-semibold text-ink">
                Cart ({count})
              </h2>
              <button
                type="button"
                onClick={() => clear()}
                className="text-[13px] font-medium text-muted transition-colors hover:text-primary"
              >
                Clear cart
              </button>
            </div>
            <div className="divide-y divide-line px-5 sm:px-6">
              {items.map((line) => (
                <CartItemRow
                  key={`${line.productId}-${line.variation ?? ""}`}
                  line={line}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4 sm:px-6">
              <ButtonLink href="/products" variant="ghost" size="sm">
                ← Continue shopping
              </ButtonLink>
              <p className="text-[13px] text-muted">
                Subtotal{" "}
                <span className="font-semibold text-ink">
                  {formatPrice(subtotal)}
                </span>
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <OrderSummary
            subtotal={subtotal}
            shipping={0}
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
                <ButtonLink href="/checkout" size="lg" className="w-full">
                  Proceed to checkout
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </ButtonLink>
                <ul className="mt-5 space-y-2.5 text-[13px] text-muted">
                  <li className="flex items-center gap-2">
                    <Truck
                      className="h-4 w-4 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                    Free express delivery over{" "}
                    {formatPrice(FREE_DELIVERY_THRESHOLD)}
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck
                      className="h-4 w-4 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                    2 year cover included on all items
                  </li>
                  <li className="flex items-center gap-2">
                    <Tag
                      className="h-4 w-4 shrink-0 text-emerald-500"
                      aria-hidden
                    />
                    Price match within 7 days of ordering
                  </li>
                </ul>
              </>
            }
          />

          <Card className="bg-soft/60">
            <p className="text-[13px] leading-relaxed text-muted">
              Need this on a company account?{" "}
              <Link
                href="/help"
                className="font-medium text-primary hover:underline"
              >
                Talk to our business team
              </Link>{" "}
              about invoicing and bulk pricing.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
