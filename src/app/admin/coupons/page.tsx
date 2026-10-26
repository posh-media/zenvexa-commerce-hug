"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/field";
import {
  createCouponAdmin,
  deleteCouponAdmin,
  listCouponsAdmin,
  updateCouponAdmin,
} from "@/services/admin-coupons.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import type { Coupon } from "@/types/coupon";

export default function AdminCouponsPage() {
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };
  const [items, setItems] = useState<Coupon[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "10",
    minimumPurchase: "0",
    maximumDiscount: "",
    usageLimit: "",
    active: true,
    endDate: "",
  });

  const reload = () => listCouponsAdmin().then(setItems).catch(() => undefined);
  useEffect(() => {
    void reload();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!actor.id) return;
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description || undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue) || 0,
        minimumPurchase: Number(form.minimumPurchase) || 0,
        maximumDiscount: form.maximumDiscount
          ? Number(form.maximumDiscount)
          : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        active: form.active,
        endDate: form.endDate ? new Date(form.endDate) : undefined,
      };
      if (editingId) {
        await updateCouponAdmin(editingId, payload, actor);
        toastSuccess("Coupon updated");
      } else {
        await createCouponAdmin(payload, actor);
        toastSuccess("Coupon created");
      }
      setEditingId(null);
      setForm({
        code: "",
        description: "",
        discountType: "percentage",
        discountValue: "10",
        minimumPurchase: "0",
        maximumDiscount: "",
        usageLimit: "",
        active: true,
        endDate: "",
      });
      await reload();
    } catch (err) {
      toastError(
        "Save failed",
        err instanceof Error ? err.message : "Could not save coupon.",
      );
    }
  };

  return (
    <RequireAdmin permission="coupons:write">
      <AdminPageHeader
        title="Coupons"
        description="Create and manage percentage or fixed discounts with limits."
      />
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-line bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-ink">
            {editingId ? "Edit coupon" : "Create coupon"}
          </h2>
          <div>
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="type">Discount type</Label>
            <Select
              id="type"
              value={form.discountType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  discountType: e.target.value as "percentage" | "fixed",
                }))
              }
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="value">Discount value</Label>
            <Input
              id="value"
              type="number"
              required
              value={form.discountValue}
              onChange={(e) =>
                setForm((f) => ({ ...f, discountValue: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="min">Minimum purchase</Label>
            <Input
              id="min"
              type="number"
              value={form.minimumPurchase}
              onChange={(e) =>
                setForm((f) => ({ ...f, minimumPurchase: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="max">Maximum discount</Label>
            <Input
              id="max"
              type="number"
              value={form.maximumDiscount}
              onChange={(e) =>
                setForm((f) => ({ ...f, maximumDiscount: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="limit">Usage limit</Label>
            <Input
              id="limit"
              type="number"
              value={form.usageLimit}
              onChange={(e) =>
                setForm((f) => ({ ...f, usageLimit: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="end">Expires</Label>
            <Input
              id="end"
              type="date"
              value={form.endDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, endDate: e.target.value }))
              }
            />
          </div>
          <Checkbox
            label="Active"
            checked={form.active}
            onChange={() => setForm((f) => ({ ...f, active: !f.active }))}
          />
          <Button type="submit" className="w-full">
            {editingId ? "Update" : "Create"}
          </Button>
        </form>

        {!items.length ? (
          <AdminEmpty title="No coupons yet" />
        ) : (
          <AdminTable headers={["Code", "Type", "Value", "Used", "Actions"]}>
            {items.map((item) => (
              <tr key={item.id} className="text-[13px]">
                <td className="px-4 py-3 font-medium text-ink">{item.code}</td>
                <td className="px-4 py-3 capitalize text-muted">
                  {item.discountType}
                </td>
                <td className="px-4 py-3">{item.discountValue}</td>
                <td className="px-4 py-3 text-muted">
                  {item.usedCount ?? 0}
                  {item.usageLimit != null ? ` / ${item.usageLimit}` : ""}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          code: item.code,
                          description: item.description ?? "",
                          discountType: item.discountType,
                          discountValue: String(item.discountValue),
                          minimumPurchase: String(item.minimumPurchase ?? 0),
                          maximumDiscount:
                            item.maximumDiscount != null
                              ? String(item.maximumDiscount)
                              : "",
                          usageLimit:
                            item.usageLimit != null
                              ? String(item.usageLimit)
                              : "",
                          active: item.active !== false,
                          endDate: "",
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-muted hover:underline"
                      onClick={() =>
                        void updateCouponAdmin(
                          item.id,
                          { active: item.active === false },
                          actor,
                        ).then(reload)
                      }
                    >
                      {item.active === false ? "Activate" : "Deactivate"}
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        if (!window.confirm(`Delete ${item.code}?`)) return;
                        void deleteCouponAdmin(item.id, actor).then(reload);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </div>
    </RequireAdmin>
  );
}
