import Link from "next/link";
import { Download, MapPin, RotateCcw, Truck } from "lucide-react";
import type { Order, OrderStatus } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProductMedia } from "@/components/commerce/product-media";

const statusTone: Record<
  OrderStatus,
  "success" | "warning" | "info" | "neutral" | "primary"
> = {
  Completed: "success",
  Pending: "warning",
  Shipped: "info",
  Cancelled: "primary",
  Returned: "neutral",
};

export function OrderCard({ order }: { order: Order }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-soft/50 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Order
            </p>
            <p className="text-sm font-semibold text-ink">{order.id}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Placed
            </p>
            <p className="text-sm text-ink-soft">{order.placedOn}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Total
            </p>
            <p className="text-sm font-semibold text-ink">{formatPrice(order.total)}</p>
          </div>
        </div>
        <Badge tone={statusTone[order.status]}>{order.status}</Badge>
      </header>

      <div className="divide-y divide-line px-5">
        {order.items.map((item) => (
          <div key={item.slug} className="flex items-center gap-4 py-4">
            <ProductMedia
              icon={item.icon}
              tone="bg-soft"
              name={item.name}
              className="h-16 w-16 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-medium text-ink">
                <Link href={`/product/${item.slug}`} className="hover:text-primary">
                  {item.name}
                </Link>
              </h3>
              <p className="mt-1 text-[13px] text-muted">
                Qty {item.qty} · {formatPrice(item.price)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4">
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {order.delivery}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/track-order"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-[13px] font-medium text-ink transition-colors hover:bg-soft"
          >
            <Truck className="h-4 w-4" aria-hidden />
            Track
          </Link>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-[13px] font-medium text-ink transition-colors hover:bg-soft"
          >
            <Download className="h-4 w-4" aria-hidden />
            Invoice
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-medium text-white transition-colors hover:bg-primary-600"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Buy again
          </button>
        </div>
      </footer>
    </article>
  );
}
