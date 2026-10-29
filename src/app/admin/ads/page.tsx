"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import {
  createAdAdmin,
  deleteAdAdmin,
  listAdsAdmin,
  updateAdAdmin,
  calculateTotalAdsExpenses,
  calculateTotalOtherExpenses,
  formatAdDate,
} from "@/services/admin-ads.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import { formatPrice } from "@/lib/utils";
import type { Ad, AdInput, ExpenseType } from "@/types/ads";

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  ads: "Ads",
  other_expense: "Other Expense",
};

const PLATFORMS = [
  "Facebook",
  "Instagram", 
  "TikTok",
  "Google",
  "X",
  "YouTube",
  "Other"
];

export default function AdminAdsPage() {
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };
  
  const emptyForm: AdInput = {
    type: "ads",
    platform: "",
    campaignName: "",
    amount: "",
    date: "",
    description: "",
  };
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdInput>(emptyForm);
  const [typeFilter, setTypeFilter] = useState<"all" | ExpenseType>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    return listAdsAdmin().then(setAds).catch(() => {
      toastError("Failed to load ads", "Could not load advertising expenses.");
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    void reload();
  }, []);

  const totalAds = calculateTotalAdsExpenses(ads);
  const totalOther = calculateTotalOtherExpenses(ads);
  const filteredAds =
    typeFilter === "all"
      ? ads
      : ads.filter((ad) => (ad.type ?? "ads") === typeFilter);

  const validateForm = (): string | null => {
    if (form.type !== "ads" && form.type !== "other_expense")
      return "Expense type is required.";
    if (form.type === "ads" && !form.platform.trim())
      return "Platform is required for ads expenses.";
    if (!form.amount.trim() || Number(form.amount) <= 0) return "Amount must be greater than 0.";
    if (!form.date.trim()) return "Date is required.";
    
    const date = new Date(form.date);
    if (isNaN(date.getTime())) return "Invalid date format.";
    
    return null;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!actor.id || saving) return;
    
    const error = validateForm();
    if (error) {
      toastError("Validation failed", error);
      return;
    }
    
    setSaving(true);
    try {
      if (editingId) {
        await updateAdAdmin(editingId, form, actor);
        toastSuccess("Ad expense updated");
      } else {
        await createAdAdmin(form, actor);
        toastSuccess("Ad expense created");
      }
      
      setEditingId(null);
      setForm(emptyForm);
      await reload();
    } catch (err) {
      toastError(
        "Save failed",
        err instanceof Error ? err.message : "Could not save ad expense.",
      );
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (ad: Ad) => {
    setEditingId(ad.id);
    setForm({
      type: ad.type ?? "ads",
      platform: ad.platform,
      campaignName: ad.campaignName || "",
      amount: String(ad.amount),
      date: ad.date,
      description: ad.description || "",
    });
  };

  const onDelete = async (ad: Ad) => {
    if (!actor.id || deletingId) return;
    
    if (!confirm(`Are you sure you want to delete this ${ad.platform} ad expense of ${formatPrice(ad.amount)}?`)) {
      return;
    }
    
    setDeletingId(ad.id);
    try {
      await deleteAdAdmin(ad.id, actor);
      setAds(prev => prev.filter(a => a.id !== ad.id));
      toastSuccess("Expense deleted");
      if (editingId === ad.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
    } catch (error) {
      toastError("Failed to delete ad expense", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setDeletingId(null);
    }
  };

  const onCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  return (
    <RequireAdmin permission="dashboard:view">
      <AdminPageHeader
        title="Ads & Expenses"
        description="Track and manage Zenvexa advertising and other business expenses."
      />
      
      <div className="space-y-6">
        {/* Total Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-[0.1em]">
              Total Ads Expenses
            </h2>
            <p className="mt-2 text-3xl font-bold text-ink">
              {formatPrice(totalAds)}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {ads.filter((a) => (a.type ?? "ads") === "ads").length} ad expense{ads.filter((a) => (a.type ?? "ads") === "ads").length !== 1 ? 's' : ''} logged
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-[0.1em]">
              Total Other Expenses
            </h2>
            <p className="mt-2 text-3xl font-bold text-ink">
              {formatPrice(totalOther)}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {ads.filter((a) => a.type === "other_expense").length} other expense{ads.filter((a) => a.type === "other_expense").length !== 1 ? 's' : ''} logged
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          {/* Form */}
          <form
            onSubmit={onSubmit}
            className="space-y-3 rounded-2xl border border-line bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-ink">
              {editingId ? "Edit expense" : "Add expense"}
            </h2>
            
            <div>
              <Label htmlFor="expenseType">Type</Label>
              <Select
                id="expenseType"
                required
                value={form.type ?? "ads"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value as ExpenseType }))
                }
              >
                <option value="ads">Ads</option>
                <option value="other_expense">Other Expense</option>
              </Select>
            </div>

            {form.type === "ads" ? (
              <>
                <div>
                  <Label htmlFor="platform">Platform / Vendor</Label>
                  <Select
                    id="platform"
                    required
                    value={form.platform}
                    onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                  >
                    <option value="">Select platform</option>
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="campaign">Campaign name</Label>
                  <Input
                    id="campaign"
                    value={form.campaignName}
                    onChange={(e) => setForm((f) => ({ ...f, campaignName: e.target.value }))}
                    placeholder="September Product Campaign"
                  />
                </div>
              </>
            ) : null}
            
            <div>
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                type="number"
                required
                min="1"
                step="1"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="150000"
              />
            </div>
            
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Weekend promotion for portable power stations"
              />
            </div>
            
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </form>

          {/* Table */}
          {loading ? (
            <div className="rounded-2xl border border-line bg-white p-6 text-center">
              <p className="text-sm text-muted">Loading expenses...</p>
            </div>
          ) : !ads.length ? (
            <AdminEmpty title="No expenses yet" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="typeFilter" className="shrink-0">Type</Label>
                <Select
                  id="typeFilter"
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as "all" | ExpenseType)
                  }
                >
                  <option value="all">All</option>
                  <option value="ads">Ads</option>
                  <option value="other_expense">Other Expense</option>
                </Select>
              </div>
            <AdminTable headers={["Type", "Platform", "Campaign", "Amount", "Date", "Description", "Actions"]}>
              {filteredAds.map((ad) => (
                <tr key={ad.id} className="text-[13px]">
                  <td className="px-4 py-3 text-muted">
                    {EXPENSE_TYPE_LABELS[ad.type ?? "ads"]}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {ad.platform || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {ad.campaignName || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {formatPrice(ad.amount)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatAdDate(ad.date)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {ad.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => onEdit(ad)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => onDelete(ad)}
                        disabled={deletingId === ad.id}
                      >
                        {deletingId === ad.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </AdminTable>
            </div>
          )}
        </div>
      </div>
    </RequireAdmin>
  );
}
