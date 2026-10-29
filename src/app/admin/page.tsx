"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import {
  AdminPageHeader,
  StatCard,
  AdminTable,
} from "@/components/admin/admin-ui";
import { ButtonLink, IconButton } from "@/components/ui/button";
import {
  getAdminDashboardStats,
  type DashboardRange,
  type DashboardStats,
} from "@/services/admin-stats.service";
import { Input, Label, Select } from "@/components/ui/field";
import { formatPrice } from "@/lib/utils";

type RangeKey = "specific" | "week" | "month" | "3months" | "year" | "all";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Resolve the selected filter into an inclusive ms range.
 * `undefined` = all time. Uses the app's local timezone, matching the
 * existing dashboard's date handling.
 */
function computeRange(
  key: RangeKey,
  specificDate: string,
): DashboardRange | undefined {
  const now = new Date();
  switch (key) {
    case "all":
      return undefined;
    case "specific": {
      if (!specificDate) return undefined;
      const d = new Date(`${specificDate}T00:00:00`);
      if (isNaN(d.getTime())) return undefined;
      return { from: startOfDay(d).getTime(), to: endOfDay(d).getTime() };
    }
    case "week": {
      // Most recent seven calendar days, including today.
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from: from.getTime(), to: endOfDay(now).getTime() };
    }
    case "month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        to: endOfDay(now).getTime(),
      };
    case "3months": {
      // Most recent three calendar months, including the current month to date.
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { from: from.getTime(), to: endOfDay(now).getTime() };
    }
    case "year":
      return {
        from: new Date(now.getFullYear(), 0, 1).getTime(),
        to: endOfDay(now).getTime(),
      };
  }
}

const RANGE_LABELS: Record<RangeKey, string> = {
  specific: "Specific date",
  week: "Last 7 days",
  month: "This month",
  "3months": "Last 3 months",
  year: "This year",
  all: "All time",
};

function formatOrderDate(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;
  const minutesStr = minutes.toString().padStart(2, "0");

  return `${month} ${day}, ${year} • ${hours12}:${minutesStr} ${ampm}`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>("all");
  const [specificDate, setSpecificDate] = useState("");

  const range = useMemo(
    () => computeRange(rangeKey, specificDate),
    [rangeKey, specificDate],
  );
  const rangeLabel = useMemo(() => {
    if (rangeKey === "specific" && specificDate) {
      const d = new Date(`${specificDate}T00:00:00`);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    }
    return RANGE_LABELS[rangeKey];
  }, [rangeKey, specificDate]);

  const load = useCallback(
    async (r?: DashboardRange) => {
      if (refreshing) return;
      setRefreshing(true);
      try {
        setStats(await getAdminDashboardStats(r));
        setError(null);
      } catch {
        setError("Could not load dashboard statistics.");
      } finally {
        setRefreshing(false);
      }
    },
    [refreshing],
  );

  useEffect(() => {
    void load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, specificDate]);

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="Live store overview from Firestore."
        actions={
          <>
            <IconButton
              label="Refresh dashboard"
              onClick={() => void load(range)}
              disabled={refreshing}
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
            </IconButton>
            <ButtonLink href="/admin/products" size="sm" variant="outline">
              Products
            </ButtonLink>
            <ButtonLink href="/admin/orders" size="sm">
              Orders
            </ButtonLink>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
        <div>
          <Label htmlFor="dashboard-range">Statistics period</Label>
          <Select
            id="dashboard-range"
            value={rangeKey}
            onChange={(e) => setRangeKey(e.target.value as RangeKey)}
          >
            <option value="specific">Specific Date</option>
            <option value="week">1 Week</option>
            <option value="month">This Month</option>
            <option value="3months">3 Months</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </Select>
        </div>
        {rangeKey === "specific" ? (
          <div>
            <Label htmlFor="dashboard-date">Date</Label>
            <Input
              id="dashboard-date"
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
            />
          </div>
        ) : null}
        <p className="pb-2 text-[13px] text-muted">
          Showing: <span className="font-medium text-ink">{rangeLabel}</span>
        </p>
      </div>

      {error ? (
        <p className="text-sm text-primary" role="alert">
          {error}
        </p>
      ) : null}

      {!stats ? (
        <p className="text-sm text-muted">Loading statistics…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={`Revenue · ${rangeLabel}`}
              value={stats.totalRevenueLabel}
              secondaryValue={
                rangeKey === "all" ? stats.todayRevenueLabel : undefined
              }
            />
            <StatCard
              label={`Orders · ${rangeLabel}`}
              value={stats.rangeOrders}
              secondaryValue={
                rangeKey === "all" ? `+${stats.ordersToday} today` : undefined
              }
            />
            <StatCard
              label={`Paid orders · ${rangeLabel}`}
              value={stats.paidOrders}
              secondaryValue={
                rangeKey === "all"
                  ? `+${stats.todayPaidOrders} today`
                  : undefined
              }
            />
            <StatCard
              label={`Pending orders · ${rangeLabel}`}
              value={stats.pendingOrders}
            />
            <StatCard
              label={`Cancelled · ${rangeLabel}`}
              value={stats.cancelledOrders}
            />
            <StatCard
              label={`Ads expenses · ${rangeLabel}`}
              value={stats.totalAdsExpensesLabel}
              secondaryValue={`After expenses: ${stats.revenueAfterAdsLabel}`}
            />
            <StatCard
              label={`Other expenses · ${rangeLabel}`}
              value={stats.totalOtherExpensesLabel}
            />
            <StatCard
              label={`Website visits · ${rangeLabel}`}
              value={stats.rangeVisits}
              secondaryValue={
                rangeKey === "all" ? `+${stats.todayVisits} today` : undefined
              }
            />
            <StatCard
              label="Products (shared catalog)"
              value={stats.products}
              secondaryValue={`-${stats.archivedProducts} (archived)`}
            />
            <StatCard
              label="Categories (shared catalog)"
              value={stats.categories}
            />
            <StatCard label="Brands (shared catalog)" value={stats.brands} />
            <StatCard label="Customers (all time)" value={stats.customers} />
            <StatCard label="Coupons (all time)" value={stats.coupons} />
            <StatCard
              label="Notifications (all time)"
              value={stats.notifications}
            />
            <StatCard
              label="Low stock (shared inventory)"
              value={stats.lowStock}
              hint="At or below threshold"
            />
            <StatCard
              label="Out of stock (shared inventory)"
              value={stats.outOfStock}
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Recent orders
              </h2>
              <AdminTable
                headers={["Order", "Customer", "Total", "Status", "Date"]}
              >
                {stats.recentOrders.map((order) => (
                  <tr key={order.id} className="text-[13px]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders?id=${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.orderNumber ?? order.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {order.customer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {formatPrice(Number(order.total ?? 0))}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted">
                      {order.orderStatus ?? order.status ?? "pending"}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {order.createdAt
                        ? order.createdAt instanceof Date
                          ? formatOrderDate(order.createdAt)
                          : typeof order.createdAt === "object" &&
                              "toDate" in order.createdAt
                            ? formatOrderDate(
                                (
                                  order.createdAt as { toDate: () => Date }
                                ).toDate(),
                              )
                            : "—"
                        : "—"}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">Top pages</h2>
              <AdminTable headers={["Page", "Visits"]}>
                {stats.topPages.map((page) => (
                  <tr key={page.path} className="text-[13px]">
                    <td className="px-4 py-3 font-medium text-ink">
                      {page.path}
                    </td>
                    <td className="px-4 py-3 text-muted">{page.count}</td>
                  </tr>
                ))}
                {stats.topPages.length === 0 ? (
                  <tr className="text-[13px]">
                    <td className="px-4 py-3 text-muted" colSpan={2}>
                      No visits recorded yet.
                    </td>
                  </tr>
                ) : null}
              </AdminTable>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Low stock products
              </h2>
              <AdminTable headers={["Product", "Stock", "SKU"]}>
                {stats.lowStockProducts.map((product) => (
                  <tr key={product.id} className="text-[13px]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/products?edit=${product.id}`}
                        className="font-medium text-ink hover:text-primary"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-primary">{product.stock}</td>
                    <td className="px-4 py-3 text-muted">
                      {product.sku ?? "—"}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
