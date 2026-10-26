"use client";

import { useState } from "react";
import { Tag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { orderGrandTotal } from "@/lib/cart";

export function OrderSummary({
  subtotal,
  shipping = 0,
  discount = 0,
  taxRate = 0.075,
  withCoupon = false,
  couponCode = "",
  couponHint,
  onApplyCoupon,
  title = "Order summary",
  footer,
}: {
  subtotal: number;
  shipping?: number;
  discount?: number;
  taxRate?: number;
  withCoupon?: boolean;
  couponCode?: string;
  /** Inline feedback from the last apply attempt. */
  couponHint?: { tone: "success" | "error"; message: string } | null;
  onApplyCoupon?: (code: string) => void | Promise<void>;
  title?: string;
  footer?: React.ReactNode;
}) {
  const [code, setCode] = useState(couponCode);
  const [applying, setApplying] = useState(false);
  const { tax, total } = orderGrandTotal({
    subtotal,
    discount,
    shipping,
    taxRate,
  });

  return (
    <Card>
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>

      {withCoupon ? (
        <form
          className="mt-5 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = code.trim();
            void (async () => {
              setApplying(true);
              try {
                await onApplyCoupon?.(next);
              } finally {
                setApplying(false);
              }
            })();
          }}
        >
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="coupon">
              Coupon code
            </label>
            <div className="relative flex-1">
              <Tag
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <input
                id="coupon"
                placeholder="Coupon code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-line pl-10 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={applying}
              className="h-11 shrink-0 rounded-xl bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary disabled:opacity-50"
            >
              {applying ? "Applying…" : "Apply"}
            </button>
          </div>
          {couponHint ? (
            <p
              role="status"
              className={
                couponHint.tone === "success"
                  ? "text-[12px] text-emerald-600"
                  : "text-[12px] text-primary"
              }
            >
              {couponHint.message}
            </p>
          ) : null}
        </form>
      ) : null}

      <dl className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">Subtotal</dt>
          <dd className="font-medium text-ink">{formatPrice(subtotal)}</dd>
        </div>
        {discount > 0 ? (
          <div className="flex items-center justify-between">
            <dt className="text-muted">
              Discount{couponCode ? ` (${couponCode})` : ""}
            </dt>
            <dd className="font-medium text-emerald-600">
              −{formatPrice(discount)}
            </dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <dt className="text-muted">Delivery fee</dt>
          <dd className="font-medium text-ink">
            {shipping === 0 ? (
              <span className="text-emerald-600">Free</span>
            ) : (
              formatPrice(shipping)
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Estimated taxes</dt>
          <dd className="font-medium text-ink">{formatPrice(tax)}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <dt className="text-[15px] font-semibold text-ink">Grand total</dt>
          <dd className="text-2xl font-semibold tracking-[-0.02em] text-ink">
            {formatPrice(total)}
          </dd>
        </div>
      </dl>

      {footer ? <div className="mt-6">{footer}</div> : null}
    </Card>
  );
}
