"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Headphones, MapPin, Package, RefreshCw, Truck } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { ProductMedia } from "@/components/commerce/product-media";
import { reverifyOrderPayment } from "@/services/payments.service";
import type { Order, OrderStatus } from "@/types/order";

const TIMELINE: Array<{ status: OrderStatus; label: string; description: string }> = [
  {
    status: "pending",
    label: "Order placed",
    description: "We received your order and are confirming stock.",
  },
  {
    status: "paid",
    label: "Payment confirmed",
    description: "Payment has been recorded.",
  },
  {
    status: "processing",
    label: "Processing",
    description: "Your items are being packed.",
  },
  {
    status: "shipped",
    label: "Shipped",
    description: "Your parcel is on the way.",
  },
  {
    status: "delivered",
    label: "Delivered",
    description: "Order delivered successfully.",
  },
];

function statusIndex(status?: OrderStatus) {
  if (!status) return 0;
  if (status === "cancelled" || status === "refunded") return -1;
  const index = TIMELINE.findIndex((step) => step.status === status);
  return index >= 0 ? index : 0;
}

function badgeTone(status?: OrderStatus) {
  if (status === "delivered") return "success" as const;
  if (status === "cancelled" || status === "refunded") return "warning" as const;
  if (status === "shipped") return "info" as const;
  return "outline" as const;
}

export default function TrackOrderPage() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("order") ?? "";
  const [query, setQuery] = useState(initial);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyId, setVerifyId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<
    { ok: boolean; message: string; orderNumber?: string } | null
  >(null);

  const load = async (orderNumber: string) => {
    const value = orderNumber.trim();
    if (!value) {
      setError("Enter an order number.");
      setOrder(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/track-order?order=${encodeURIComponent(value)}`);
      const data = await response.json();
      
      if (!response.ok) {
        setOrder(null);
        setError(data.reason || "Could not load that order.");
        return;
      }
      
      if (!data.ok) {
        setOrder(null);
        setError(data.reason || "No order found for that number.");
        return;
      }
      
      setOrder(data.order);
    } catch {
      setOrder(null);
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initial) void load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const currentStatus = order?.orderStatus ?? order?.status;
  const currentIndex = statusIndex(currentStatus);
  const items = order?.products ?? order?.items ?? [];
  const address = order?.shippingAddress;

  const timeline = useMemo(() => {
    if (order?.timeline?.length) {
      return order.timeline.map((entry, index, all) => ({
        label: entry.label,
        description: entry.description ?? "",
        state:
          index < all.length - 1
            ? ("done" as const)
            : ("current" as const),
      }));
    }
    if (currentIndex < 0) {
      return [
        {
          label: "Order cancelled",
          description: `Status: ${currentStatus}`,
          state: "current" as const,
        },
      ];
    }
    return TIMELINE.filter((step) => step.status !== "paid").map((step) => {
      const adjustedIndex =
        step.status === "pending"
          ? 0
          : step.status === "processing"
            ? 1
            : step.status === "shipped"
              ? 2
              : 3;
      const mappedCurrent =
        currentStatus === "pending"
          ? 0
          : currentStatus === "paid" || currentStatus === "processing"
            ? 1
            : currentStatus === "shipped"
              ? 2
              : currentStatus === "delivered"
                ? 3
                : 0;
      return {
        label: step.label,
        description: step.description,
        state:
          adjustedIndex < mappedCurrent
            ? ("done" as const)
            : adjustedIndex === mappedCurrent
              ? ("current" as const)
              : ("upcoming" as const),
      };
    });
  }, [currentIndex, currentStatus, order?.timeline]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void load(query);
  };

  const onVerify = async () => {
    const orderId = verifyId.trim();
    if (!orderId || verifying) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await reverifyOrderPayment(orderId);
      if (result.ok) {
        const orderNumber = result.order.orderNumber ?? result.order.id;
        const isCodFee = "codCommitmentFee" in result && result.codCommitmentFee;
        if ("alreadyPaid" in result && result.alreadyPaid) {
          setVerifyResult({
            ok: true,
            message: isCodFee
              ? "The commitment fee for this order has already been verified. The balance is due on delivery."
              : "Payment for this order has already been verified.",
            orderNumber,
          });
        } else {
          setVerifyResult({
            ok: true,
            message: isCodFee
              ? "Commitment fee verified — your order is confirmed. The remaining balance is due on delivery."
              : "Payment verified successfully — your order is confirmed.",
            orderNumber,
          });
        }
        // Refresh the tracked order if it matches.
        if (order && (order.id === result.order.id || order.orderNumber === orderNumber)) {
          void load(orderNumber);
        }
      } else {
        setVerifyResult({ ok: false, message: result.reason });
      }
    } catch {
      setVerifyResult({
        ok: false,
        message: "Could not verify payment. Check your connection and try again.",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Track order" }]}
        title="Track your order"
        description="Enter an order number to see live progress."
      />

      <Card className="mb-8">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
          <div className="flex-1">
            <Input
              placeholder="Order number, e.g. SB-…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Order number"
              icon={<Package className="h-[18px] w-[18px]" />}
            />
          </div>
          <Button size="lg" className="sm:w-auto" type="submit" disabled={loading}>
            {loading ? "Tracking…" : "Track"}
          </Button>
        </form>
        {error ? (
          <p className="mt-3 text-[13px] text-primary" role="alert">
            {error}
          </p>
        ) : null}
      </Card>

      <Card className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] font-medium text-ink">
            Have you paid and yet to verify?
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setVerifyOpen((open) => !open);
              setVerifyResult(null);
              if (!verifyOpen && order) {
                setVerifyId(order.orderNumber ?? order.id);
              }
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Verify
          </Button>
        </div>
        {verifyOpen ? (
          <div className="mt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Input
                  placeholder="Order ID, e.g. SB-…"
                  value={verifyId}
                  onChange={(event) => setVerifyId(event.target.value)}
                  aria-label="Order ID to verify"
                />
              </div>
              <Button
                onClick={() => void onVerify()}
                disabled={verifying || !verifyId.trim()}
              >
                {verifying ? "Verifying…" : "Verify payment"}
              </Button>
            </div>
            {verifyResult ? (
              <div className="mt-3" role="status">
                <p
                  className={
                    verifyResult.ok
                      ? "text-[13px] text-emerald-700"
                      : "text-[13px] text-primary"
                  }
                >
                  {verifyResult.message}
                </p>
                {verifyResult.ok && verifyResult.orderNumber ? (
                  <ButtonLink
                    href={`/track-order?order=${encodeURIComponent(verifyResult.orderNumber)}`}
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                  >
                    View order details
                  </ButtonLink>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {!order ? null : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
          <div className="space-y-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                    Order {order.orderNumber ?? order.id}
                  </p>
                  <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-ink">
                    {(currentStatus ?? "pending").replaceAll("_", " ")}
                  </h2>
                  <p className="mt-1 text-[13px] text-muted">
                    Payment: {order.paymentStatus ?? "pending"}
                  </p>
                </div>
                <Badge tone={badgeTone(currentStatus)}>
                  <Truck className="h-3 w-3" aria-hidden />
                  {currentStatus ?? "pending"}
                </Badge>
              </div>

              <ol className="mt-7">
                {timeline.map((step, index) => {
                  const isLast = index === timeline.length - 1;
                  return (
                    <li key={step.label} className="relative flex gap-4 pb-8 last:pb-0">
                      {!isLast ? (
                        <span
                          className={
                            step.state === "done"
                              ? "absolute left-[15px] top-8 h-full w-0.5 bg-primary"
                              : "absolute left-[15px] top-8 h-full w-0.5 bg-line"
                          }
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className={
                          step.state === "done"
                            ? "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white"
                            : step.state === "current"
                              ? "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-primary bg-white"
                              : "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-white"
                        }
                      >
                        {step.state === "done" ? (
                          <Check className="h-4 w-4" aria-hidden />
                        ) : step.state === "current" ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
                        ) : (
                          <span className="h-2.5 w-2.5 rounded-full bg-line" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 pt-1">
                        <p
                          className={
                            step.state === "upcoming"
                              ? "text-[15px] font-medium text-muted"
                              : "text-[15px] font-medium text-ink"
                          }
                        >
                          {step.label}
                        </p>
                        <p className="mt-1 text-[13px] text-muted">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <Card padded={false}>
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <h2 className="text-[15px] font-semibold text-ink">Order details</h2>
              </div>
              <ul className="divide-y divide-line px-5 sm:px-6">
                {items.map((item) => (
                  <li
                    key={`${item.productId}-${item.variation ?? ""}`}
                    className="flex items-center gap-4 py-4"
                  >
                    <ProductMedia
                      icon="cpu"
                      tone="bg-soft"
                      name={item.name ?? item.productId}
                      src={item.image}
                      className="h-16 w-16 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {item.name ?? item.productId}
                      </p>
                      <p className="mt-1 text-[13px] text-muted">
                        Qty {item.quantity}
                        {item.variation ? ` · ${item.variation}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      {formatPrice(
                        item.lineTotal ??
                          (item.unitPrice ?? 0) * item.quantity,
                      )}
                    </p>
                  </li>
                ))}
              </ul>
              <dl className="space-y-3 border-t border-line px-5 py-5 text-sm sm:px-6">
                <div className="flex justify-between">
                  <dt className="text-muted">Payment</dt>
                  <dd className="text-ink">{order.paymentStatus ?? "pending"}</dd>
                </div>
                {order.codCommitmentFee !== undefined ? (
                  <div className="flex justify-between">
                    <dt className="text-muted">Commitment fee</dt>
                    <dd className="text-ink">
                      {formatPrice(order.codAmountPaid ?? 0)} paid
                      {order.codBalance
                        ? ` · ${formatPrice(order.codBalance)} due on delivery`
                        : ""}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted">Order total</dt>
                  <dd className="font-semibold text-ink">
                    {formatPrice(order.total ?? 0)}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            <Card>
              <h2 className="text-[15px] font-semibold text-ink">
                Delivery address
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-muted">
                <span className="block font-medium text-ink">
                  {address?.fullName ?? order.customer?.name ?? "—"}
                </span>
                {address
                  ? [address.line1, address.city, address.state, address.country]
                      .filter(Boolean)
                      .join(", ")
                  : "—"}
                {address?.phone || order.customer?.phone ? (
                  <span className="mt-2 block">
                    {address?.phone ?? order.customer?.phone}
                  </span>
                ) : null}
              </p>
              <p className="mt-4 flex items-center gap-2 text-[13px] text-muted">
                <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                Tracking: {order.trackingNumber ?? "Assigned after dispatch"}
              </p>
            </Card>

            <Card className="space-y-3">
              <ButtonLink href="/help" variant="outline" size="sm" className="w-full">
                <Headphones className="h-4 w-4" aria-hidden />
                Get help with this order
              </ButtonLink>
              <ButtonLink
                href={`/refund-request?order=${encodeURIComponent(order.orderNumber ?? order.id)}`}
                variant="ghost"
                size="sm"
                className="w-full"
              >
                Request a refund
              </ButtonLink>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
