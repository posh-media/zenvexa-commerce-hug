"use client";

import { useEffect, useState } from "react";
import {
  AdminPageHeader,
  AdminTable,
  StatCard,
} from "@/components/admin/admin-ui";
import { RequireAdmin } from "@/components/auth/require-admin";
import {
  getAdminAnalytics,
  type AnalyticsSnapshot,
} from "@/services/admin-stats.service";
import { formatPrice } from "@/lib/utils";

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAdminAnalytics()
      .then(setData)
      .catch(() => setError("Could not load analytics."));
  }, []);

  return (
    <RequireAdmin permission="analytics:view">
      <AdminPageHeader
        title="Analytics"
        description="Sales, catalogue and customer insights from Firestore. Ready for external analytics later."
      />
      {error ? (
        <p className="text-sm text-primary" role="alert">
          {error}
        </p>
      ) : null}
      {!data ? (
        <p className="text-sm text-muted">Loading analytics…</p>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total revenue"
              value={formatPrice(data.totalRevenue)}
            />
            <StatCard
              label="Average order value"
              value={formatPrice(data.averageOrderValue)}
            />
            <StatCard label="New customers (30d)" value={data.newCustomers} />
            <StatCard
              label="Pending orders"
              value={data.orderStatusCounts.pending ?? 0}
            />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Revenue (last 7 days)
            </h2>
            <div className="grid grid-cols-7 gap-2 rounded-2xl border border-line bg-white p-4">
              {data.revenueByDay.map((day) => (
                <div key={day.label} className="text-center">
                  <div
                    className="mx-auto mb-2 w-full rounded-md bg-primary/15"
                    style={{
                      height: `${Math.max(8, Math.min(96, day.value / 5000))}px`,
                    }}
                    title={formatPrice(day.value)}
                  />
                  <p className="text-[11px] text-muted">{day.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Best selling
              </h2>
              <AdminTable headers={["Product", "Sales"]}>
                {data.bestSellers.map((row) => (
                  <tr key={row.id} className="text-[13px]">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.sales}</td>
                  </tr>
                ))}
              </AdminTable>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Most viewed
              </h2>
              <AdminTable headers={["Product", "Views"]}>
                {data.mostViewed.map((row) => (
                  <tr key={row.id} className="text-[13px]">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.views}</td>
                  </tr>
                ))}
              </AdminTable>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Top customers
              </h2>
              <AdminTable headers={["Customer", "Spent"]}>
                {data.topCustomers.map((row) => (
                  <tr key={row.id} className="text-[13px]">
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{formatPrice(row.spent)}</td>
                  </tr>
                ))}
              </AdminTable>
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Coupon usage
              </h2>
              <AdminTable headers={["Code", "Used"]}>
                {data.couponUsage.map((row) => (
                  <tr key={row.code} className="text-[13px]">
                    <td className="px-4 py-3">{row.code}</td>
                    <td className="px-4 py-3">{row.used}</td>
                  </tr>
                ))}
              </AdminTable>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Order status mix
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.orderStatusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] capitalize text-ink"
                >
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </RequireAdmin>
  );
}
