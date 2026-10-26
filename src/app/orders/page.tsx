"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EmptyBoxIllustration } from "@/components/ui/illustrations";
import { cartLineFromProduct } from "@/lib/commerce-adapters";
import { formatPrice } from "@/lib/utils";
import { toProductView } from "@/lib/product-view";
import { listOrdersByUser } from "@/services/orders.service";
import { getProductById } from "@/services/products.service";
import { useCartStore } from "@/stores/cart.store";
import { useUserStore } from "@/stores/user.store";
import type { Order } from "@/types/order";

function OrdersContent() {
  const uid = useUserStore((state) => state.authUser?.uid);
  const addItem = useCartStore((state) => state.addItem);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setLoading(true);
    void listOrdersByUser(uid)
      .then((list) => {
        if (cancelled) return;
        setOrders(
          [...list].sort((a, b) => {
            const aTime =
              a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const bTime =
              b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
            return bTime - aTime;
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const reorder = async (order: Order) => {
    const items = order.products ?? order.items ?? [];
    let added = 0;
    for (const item of items) {
      const product = await getProductById(item.productId);
      if (!product || product.active === false || product.stock <= 0) continue;
      const view = toProductView(product);
      const result = addItem(
        cartLineFromProduct(view, {
          quantity: Math.min(item.quantity, product.stock),
          variation: item.variation,
        }),
      );
      if (result.ok) added += 1;
    }
    setMessage(
      added
        ? `${added} item${added === 1 ? "" : "s"} added to your cart.`
        : "No available items could be reordered.",
    );
  };

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Orders" }]}
        title="Order history"
        description="Review past orders, track delivery and reorder available items."
      />

      {message ? (
        <p className="mb-4 text-[13px] text-emerald-700">{message}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">Loading orders…</p>
      ) : !orders.length ? (
        <EmptyState
          illustration={<EmptyBoxIllustration />}
          title="No orders yet"
          description="When you complete checkout, your orders will show up here."
          actions={
            <>
              <ButtonLink href="/products">Continue shopping</ButtonLink>
              <ButtonLink href="/track-order" variant="outline">
                Track an order
              </ButtonLink>
            </>
          }
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const items = order.products ?? order.items ?? [];
            const placed =
              order.createdAt instanceof Date
                ? order.createdAt.toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—";
            return (
              <Card key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                      {order.orderNumber ?? order.id}
                    </p>
                    <p className="mt-1 text-[15px] font-semibold text-ink">
                      {formatPrice(order.total ?? 0)}
                    </p>
                    <p className="mt-1 text-[13px] text-muted">
                      {placed} · {items.length} product
                      {items.length === 1 ? "" : "s"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone="outline">
                        Order: {order.orderStatus ?? order.status ?? "pending"}
                      </Badge>
                      <Badge tone="neutral">
                        Payment: {order.paymentStatus ?? "pending"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ButtonLink
                      href={`/track-order?order=${encodeURIComponent(order.orderNumber ?? order.id)}`}
                      size="sm"
                      variant="outline"
                    >
                      View details
                    </ButtonLink>
                    <Button
                      size="sm"
                      onClick={() => void reorder(order)}
                    >
                      Reorder
                    </Button>
                    <ButtonLink
                      href={`/refund-request?order=${encodeURIComponent(order.orderNumber ?? order.id)}`}
                      size="sm"
                      variant="ghost"
                    >
                      Request refund
                    </ButtonLink>
                  </div>
                </div>
              </Card>
            );
          })}
          <div className="pt-4">
            <ButtonLink href="/products" variant="outline">
              Continue shopping
            </ButtonLink>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderHistoryPage() {
  return (
    <RequireAuth>
      <OrdersContent />
    </RequireAuth>
  );
}
