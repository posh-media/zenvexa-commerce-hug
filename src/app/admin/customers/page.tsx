"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Input, Select } from "@/components/ui/field";
import {
  listCustomersAdmin,
  setCustomerStatusAdmin,
  setUserRoleAdmin,
  type AdminCustomerRow,
} from "@/services/admin-customers.service";
import { listAddressesByUser } from "@/services/addresses.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import { formatPrice } from "@/lib/utils";
import { USER_ROLES, type UserRole } from "@/constants/app";
import type { Address } from "@/types/address";

const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Customer",
  super_admin: "Super Admin",
  admin: "Admin",
  inventory_manager: "Inventory Manager",
  order_manager: "Order Manager",
  customer_support: "Customer Support",
  marketing_manager: "Marketing Manager",
  staff: "Staff (legacy)",
};

export default function AdminCustomersPage() {
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actorRole = profile?.role;
  const canManageRoles =
    actorRole === "super_admin" || actorRole === "admin";
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminCustomerRow | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [roleDraft, setRoleDraft] = useState<UserRole>("customer");
  const [savingRole, setSavingRole] = useState(false);

  const reload = () =>
    listCustomersAdmin().then(setCustomers).catch(() => undefined);

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!selected) {
      setAddresses([]);
      return;
    }
    setRoleDraft((selected.role as UserRole) || "customer");
    void listAddressesByUser(selected.id)
      .then(setAddresses)
      .catch(() => setAddresses([]));
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.displayName, c.display_name, c.email, c.phone, c.id, c.role]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [customers, query]);

  const saveRole = async () => {
    if (!selected || !canManageRoles) return;
    setSavingRole(true);
    try {
      await setUserRoleAdmin(selected.id, roleDraft, actor);
      toastSuccess("Role updated", ROLE_LABELS[roleDraft]);
      const rows = await listCustomersAdmin();
      setCustomers(rows);
      setSelected(rows.find((row) => row.id === selected.id) ?? null);
    } catch (error) {
      toastError(
        "Could not update role",
        error instanceof Error ? error.message : "Permission denied.",
      );
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <RequireAdmin permission="customers:read">
      <AdminPageHeader
        title="Customers"
        description="Profiles, roles, spend, addresses and account status. Auth credentials are never exposed."
      />
      <div className="mb-4">
        <Input
          placeholder="Search customers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {!filtered.length ? (
          <AdminEmpty title="No customers found" />
        ) : (
          <AdminTable
            headers={["Customer", "Role", "Orders", "Spent", "Status", "Joined"]}
          >
            {filtered.map((customer) => (
              <tr
                key={customer.id}
                className="cursor-pointer text-[13px] hover:bg-soft/60"
                onClick={() => setSelected(customer)}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">
                    {customer.displayName ||
                      customer.display_name ||
                      "Customer"}
                  </p>
                  <p className="text-[11px] text-muted">{customer.email}</p>
                </td>
                <td className="px-4 py-3 capitalize text-muted">
                  {ROLE_LABELS[(customer.role as UserRole) || "customer"] ??
                    customer.role ??
                    "customer"}
                </td>
                <td className="px-4 py-3">{customer.orderCount}</td>
                <td className="px-4 py-3">
                  {formatPrice(customer.totalSpent)}
                </td>
                <td className="px-4 py-3 capitalize text-muted">
                  {customer.status ??
                    (customer.active === false ? "suspended" : "active")}
                </td>
                <td className="px-4 py-3 text-muted">
                  {customer.createdAt instanceof Date
                    ? customer.createdAt.toLocaleDateString()
                    : customer.created_time instanceof Date
                      ? customer.created_time.toLocaleDateString()
                      : "—"}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}

        <div className="rounded-2xl border border-line bg-white p-4">
          {!selected ? (
            <p className="text-sm text-muted">Select a customer.</p>
          ) : (
            <div className="space-y-4 text-[13px]">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {selected.displayName ||
                    selected.display_name ||
                    "Customer"}
                </h2>
                <p className="text-muted">{selected.email}</p>
                <p className="text-muted">{selected.phone || "No phone"}</p>
                <p className="mt-1 capitalize text-muted">
                  Role:{" "}
                  {ROLE_LABELS[(selected.role as UserRole) || "customer"] ??
                    selected.role ??
                    "customer"}
                </p>
              </div>

              {canManageRoles ? (
                <div className="space-y-2 rounded-xl border border-line bg-soft/40 p-3">
                  <p className="font-medium text-ink">Staff role</p>
                  <Select
                    value={roleDraft}
                    onChange={(e) => setRoleDraft(e.target.value as UserRole)}
                    aria-label="User role"
                  >
                    {USER_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    disabled={
                      savingRole || roleDraft === (selected.role || "customer")
                    }
                    className="rounded-full bg-ink px-3 py-1.5 text-white disabled:opacity-40"
                    onClick={() => void saveRole()}
                  >
                    {savingRole ? "Saving…" : "Save role"}
                  </button>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1.5 hover:bg-soft"
                  onClick={() =>
                    void setCustomerStatusAdmin(
                      selected.id,
                      "suspended",
                      actor,
                    ).then(() => {
                      toastSuccess("Customer suspended");
                      return reload();
                    })
                  }
                >
                  Suspend
                </button>
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1.5 hover:bg-soft"
                  onClick={() =>
                    void setCustomerStatusAdmin(
                      selected.id,
                      "active",
                      actor,
                    ).then(() => {
                      toastSuccess("Customer reactivated");
                      return reload();
                    })
                  }
                >
                  Reactivate
                </button>
                <Link
                  href={`/admin/orders?q=${encodeURIComponent(selected.id)}`}
                  className="rounded-full border border-line px-3 py-1.5 hover:bg-soft"
                >
                  View orders
                </Link>
              </div>
              <div>
                <p className="mb-2 font-medium text-ink">Addresses</p>
                {!addresses.length ? (
                  <p className="text-muted">No saved addresses.</p>
                ) : (
                  <ul className="space-y-2 text-muted">
                    {addresses.map((address) => (
                      <li key={address.id}>
                        {address.recipientName} — {address.addressLine},{" "}
                        {address.city}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </RequireAdmin>
  );
}
