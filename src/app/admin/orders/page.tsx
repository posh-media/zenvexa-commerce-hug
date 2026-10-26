"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Input, Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/constants/app";
import {
  getOrderAdmin,
  listOrdersAdmin,
  listOrdersAdminPage,
  setOrderTrackingAdmin,
  updateOrderPaymentStatusAdmin,
  updateOrderStatusAdmin,
  deleteOrderAdmin,
  sendOrderEmailAdmin,
} from "@/services/admin-orders.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderStatus, PaymentStatus } from "@/types/order";
import type { QueryDocumentSnapshot } from "firebase/firestore";

const PAGE_SIZE = 25;

function OrdersInner() {
  const searchParams = useSearchParams();
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[] | null>(null);
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  // cursors[i] = last document of page i (0-based); used as startAfter for i+1
  const [cursors, setCursors] = useState<
    (QueryDocumentSnapshot<Order> | null)[]
  >([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [tracking, setTracking] = useState("");
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const searching = query.trim().length > 0;

  const orderTime = (order: Order) => {
    const createdAt = order.createdAt;
    if (createdAt instanceof Date) return createdAt.getTime();
    if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
      return (createdAt as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      const date = new Date(createdAt);
      return isNaN(date.getTime()) ? 0 : date.getTime();
    }
    return 0;
  };

  const formatOrderDate = (order: Order): string => {
    const timestamp = orderTime(order);
    if (!timestamp) return "—";
    
    const date = new Date(timestamp);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutesStr = minutes.toString().padStart(2, '0');
    
    return `${month} ${day}, ${year} • ${hours12}:${minutesStr} ${ampm}`;
  };

  // Server-side paged fetch (no text search active)
  const loadPage = useCallback(
    async (pageIndex: number, after: QueryDocumentSnapshot<Order> | null) => {
      setLoading(true);
      try {
        const result = await listOrdersAdminPage({
          paymentStatus: paymentFilter,
          orderStatus: statusFilter,
          pageSize: PAGE_SIZE,
          after,
        });
        setOrders(result.orders);
        setTotal(result.total);
        setPage(pageIndex);
        if (result.lastDoc) {
          setCursors((prev) => {
            const next = [...prev];
            next[pageIndex] = result.lastDoc;
            return next;
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [paymentFilter, statusFilter],
  );

  // Search mode: Firestore can't do substring search, so fetch all once and
  // filter/paginate client-side (preserves the previous search behaviour).
  useEffect(() => {
    if (!searching) {
      setAllOrders(null);
      return;
    }
    setLoading(true);
    listOrdersAdmin()
      .then(setAllOrders)
      .catch(() => toastError("Could not load orders"))
      .finally(() => setLoading(false));
  }, [searching]);

  // Reset pagination whenever filters change (paged mode)
  useEffect(() => {
    if (searching) {
      setPage(0);
      return;
    }
    setCursors([]);
    void loadPage(0, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentFilter, statusFilter, searching]);

  const filteredAll = useMemo(() => {
    if (!allOrders) return [];
    let next = allOrders;
    const q = query.trim().toLowerCase();
    next = next.filter((o) =>
      [o.orderNumber, o.id, o.customer?.name, o.customer?.email, o.userId]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
    if (paymentFilter !== "all") {
      next = next.filter(
        (o) => (o.paymentStatus ?? "pending") === paymentFilter,
      );
    }
    if (statusFilter !== "all") {
      next = next.filter(
        (o) => (o.orderStatus ?? o.status) === statusFilter,
      );
    }
    return [...next].sort((a, b) => orderTime(b) - orderTime(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOrders, query, paymentFilter, statusFilter]);

  // Displayed page + total for the active mode
  const displayed = searching
    ? filteredAll.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : orders;
  const displayTotal = searching ? filteredAll.length : total;
  const start = displayTotal === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = page * PAGE_SIZE + displayed.length;
  const hasPrev = page > 0;
  const hasNext = end < displayTotal;

  const goNext = () => {
    if (searching) {
      setPage((p) => p + 1);
      return;
    }
    const cursor = cursors[page];
    if (cursor) void loadPage(page + 1, cursor);
  };

  const goPrev = () => {
    if (searching) {
      setPage((p) => Math.max(0, p - 1));
      return;
    }
    void loadPage(page - 1, page - 2 >= 0 ? (cursors[page - 2] ?? null) : null);
  };

  const refresh = () => {
    if (searching) {
      setLoading(true);
      listOrdersAdmin()
        .then(setAllOrders)
        .catch(() => undefined)
        .finally(() => setLoading(false));
      return;
    }
    void loadPage(page, page - 1 >= 0 ? (cursors[page - 1] ?? null) : null);
  };

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const found = [...orders, ...(allOrders ?? [])].find((o) => o.id === id);
    if (found) {
      setSelected(found);
      setTracking(found.trackingNumber ?? "");
      return;
    }
    // Order may be on another page — fetch it directly
    void getOrderAdmin(id).then((order) => {
      if (order) {
        setSelected(order);
        setTracking(order.trackingNumber ?? "");
      }
    });
  }, [orders, allOrders, searchParams]);

  return (
    <RequireAdmin permission="orders:read">
      <AdminPageHeader
        title="Orders"
        description="Search, filter and update fulfilment and payment status. Refunds are prepared for Paystack Admin later."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Search orders…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          aria-label="Payment status filter"
        >
          <option value="all">All payments</option>
          {PAYMENT_STATUS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Order status filter"
        >
          <option value="all">All order statuses</option>
          {ORDER_STATUS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          {!displayed.length && !loading ? (
            <AdminEmpty title="No orders found" />
          ) : (
            <AdminTable
              headers={["Order", "Customer", "Total", "Payment", "Status", "Date", "Actions"]}
            >
              {displayed.map((order) => (
              <tr
                key={order.id}
                className="cursor-pointer text-[13px] hover:bg-soft/60"
                onClick={() => {
                  setSelected(order);
                  setTracking(order.trackingNumber ?? "");
                }}
              >
                <td className="px-4 py-3 font-medium text-ink">
                  {order.orderNumber ?? order.id}
                </td>
                <td className="px-4 py-3 text-muted">
                  {order.customer?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {formatPrice(Number(order.total ?? 0))}
                </td>
                <td className="px-4 py-3 capitalize text-muted">
                  {order.paymentStatus ?? "pending"}
                  {String(order.paymentMethod ?? "") === "cash-on-delivery" &&
                  order.commitmentFeeStatus ? (
                    <span className="block text-[11px] normal-case">
                      COD fee: {order.commitmentFeeStatus}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 capitalize text-muted">
                  {order.orderStatus ?? order.status ?? "pending"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {formatOrderDate(order)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {order.paymentStatus === "paid" && order.makeNotifyStatus !== "sent" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async (e) => {
                          e.stopPropagation();
                          setSendingEmail(order.id);
                          try {
                            await sendOrderEmailAdmin(order.id, actor);
                            toastSuccess("Email sent successfully");
                            // Update the order in local state to reflect the sent status
                            setOrders(prev => prev.map(o => 
                              o.id === order.id 
                                ? { ...o, makeNotifyStatus: "sent" } 
                                : o
                            ));
                            setAllOrders(prev => prev?.map(o =>
                              o.id === order.id
                                ? { ...o, makeNotifyStatus: "sent" }
                                : o
                            ) ?? null);
                          } catch (error) {
                            toastError("Failed to send email", error instanceof Error ? error.message : "Unknown error");
                          } finally {
                            setSendingEmail(null);
                          }
                        }}
                        disabled={sendingEmail === order.id}
                      >
                        {sendingEmail === order.id ? "Sending..." : "Send Email"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Are you sure you want to delete order ${order.orderNumber ?? order.id}? This action cannot be undone.`)) {
                          setDeletingOrder(order.id);
                          try {
                            await deleteOrderAdmin(order.id, actor);
                            setOrders(prev => prev.filter(o => o.id !== order.id));
                            setAllOrders(prev => prev?.filter(o => o.id !== order.id) ?? null);
                            setTotal((t) => Math.max(0, t - 1));
                            toastSuccess("Order deleted successfully");
                            if (selected?.id === order.id) {
                              setSelected(null);
                            }
                          } catch (error) {
                            toastError("Failed to delete order", error instanceof Error ? error.message : "Unknown error");
                          } finally {
                            setDeletingOrder(null);
                          }
                        }
                      }}
                      disabled={deletingOrder === order.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      {deletingOrder === order.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            </AdminTable>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted">
              {loading
                ? "Loading orders…"
                : `Showing ${start}–${end} of ${displayTotal} orders`}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={goPrev}
                disabled={!hasPrev || loading}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={goNext}
                disabled={!hasNext || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4">
          {!selected ? (
            <p className="text-sm text-muted">Select an order to manage.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Order
                </p>
                <h2 className="text-lg font-semibold text-ink">
                  {selected.orderNumber ?? selected.id}
                </h2>
                <p className="text-[13px] text-muted">
                  {selected.customer?.name} · {selected.customer?.email}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  Method: {selected.paymentMethod ?? "—"} · Ref:{" "}
                  {selected.paymentReference ?? "—"}
                </p>
                {String(selected.paymentMethod ?? "") === "cash-on-delivery" &&
                selected.codCommitmentFee !== undefined ? (
                  <div className="mt-2 rounded-lg bg-soft/60 px-3 py-2 text-[12px] text-muted">
                    <p>
                      Commitment fee ({formatPrice(selected.codCommitmentFee)}):{" "}
                      <span className="font-medium text-ink">
                        {selected.commitmentFeeStatus ?? "pending"}
                      </span>
                      {selected.paymentGateway
                        ? ` via ${selected.paymentGateway}`
                        : ""}
                    </p>
                    <p>
                      Paid: {formatPrice(selected.codAmountPaid ?? 0)} · Balance
                      on delivery: {formatPrice(selected.codBalance ?? 0)}
                    </p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => window.print()}
                >
                  Print invoice
                </Button>
              </div>

              <div>
                <Label htmlFor="orderStatus">Order status</Label>
                <Select
                  id="orderStatus"
                  value={selected.orderStatus ?? selected.status ?? "pending"}
                  onChange={(e) => {
                    const value = e.target.value as OrderStatus;
                    void updateOrderStatusAdmin(selected.id, value, actor).then(
                      () => {
                        toastSuccess("Order status updated");
                        refresh();
                        setSelected((s) =>
                          s ? { ...s, orderStatus: value, status: value } : s,
                        );
                      },
                    );
                  }}
                >
                  {ORDER_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="payStatus">Payment status</Label>
                <Select
                  id="payStatus"
                  value={selected.paymentStatus ?? "pending"}
                  onChange={(e) => {
                    const value = e.target.value as PaymentStatus;
                    void updateOrderPaymentStatusAdmin(
                      selected.id,
                      value,
                      actor,
                    ).then(() => {
                      toastSuccess("Payment status updated");
                      refresh();
                      setSelected((s) =>
                        s ? { ...s, paymentStatus: value } : s,
                      );
                    });
                  }}
                >
                  {PAYMENT_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-muted">
                  Do not mark paid unless Paystack verification succeeded.
                </p>
              </div>

              <div>
                <Label htmlFor="tracking">Tracking number</Label>
                <div className="flex gap-2">
                  <Input
                    id="tracking"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={() =>
                      void setOrderTrackingAdmin(
                        selected.id,
                        tracking.trim(),
                        actor,
                      ).then(() => toastSuccess("Tracking updated"))
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-ink">Timeline</p>
                <ul className="space-y-2 text-[12px] text-muted">
                  {(selected.timeline ?? []).map((entry, index) => (
                    <li key={`${entry.event}-${index}`}>
                      <span className="font-medium text-ink">{entry.label}</span>
                      {entry.description ? ` — ${entry.description}` : ""}
                    </li>
                  ))}
                  {!selected.timeline?.length ? (
                    <li>No timeline entries yet.</li>
                  ) : null}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-ink">Items</p>
                <ul className="space-y-1 text-[13px] text-muted">
                  {(selected.products ?? selected.items ?? []).map((line) => (
                    <li key={`${line.productId}-${line.variation ?? ""}`}>
                      {line.name} × {line.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </RequireAdmin>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <OrdersInner />
    </Suspense>
  );
}
