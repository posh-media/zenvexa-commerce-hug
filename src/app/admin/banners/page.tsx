"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { RequireAdmin } from "@/components/auth/require-admin";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/field";
import { BANNER_PLACEMENTS } from "@/types/admin";
import {
  createBannerAdmin,
  deleteBannerAdmin,
  listBannersAdmin,
  updateBannerAdmin,
} from "@/services/banners.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import type { Banner } from "@/types/admin";

export default function AdminBannersPage() {
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };
  const [items, setItems] = useState<Banner[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    ctaLabel: "",
    href: "",
    imageUrl: "",
    placement: "home",
    displayOrder: "0",
    active: true,
    startDate: "",
    endDate: "",
  });

  const reload = () => listBannersAdmin().then(setItems).catch(() => undefined);
  useEffect(() => {
    void reload();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!actor.id) return;
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle || undefined,
        ctaLabel: form.ctaLabel || undefined,
        href: form.href || undefined,
        imageUrl: form.imageUrl || undefined,
        placement: form.placement,
        displayOrder: Number(form.displayOrder) || 0,
        active: form.active,
        startDate: form.startDate ? new Date(form.startDate) : undefined,
        endDate: form.endDate ? new Date(form.endDate) : undefined,
      };
      if (editingId) {
        await updateBannerAdmin(editingId, payload, actor);
        toastSuccess("Banner updated");
      } else {
        await createBannerAdmin(payload, actor);
        toastSuccess("Banner created");
      }
      setEditingId(null);
      setForm({
        title: "",
        subtitle: "",
        ctaLabel: "",
        href: "",
        imageUrl: "",
        placement: "home",
        displayOrder: "0",
        active: true,
        startDate: "",
        endDate: "",
      });
      await reload();
    } catch (err) {
      toastError(
        "Save failed",
        err instanceof Error ? err.message : "Could not save banner.",
      );
    }
  };

  return (
    <RequireAdmin permission="banners:write">
      <AdminPageHeader
        title="Banners"
        description="Home, promo, flash sale and campaign banners stored in Firestore."
      />
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-line bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-ink">
            {editingId ? "Edit banner" : "Create banner"}
          </h2>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="subtitle">Subtitle</Label>
            <Input
              id="subtitle"
              value={form.subtitle}
              onChange={(e) =>
                setForm((f) => ({ ...f, subtitle: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="cta">CTA label</Label>
            <Input
              id="cta"
              value={form.ctaLabel}
              onChange={(e) =>
                setForm((f) => ({ ...f, ctaLabel: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor="href">Destination link</Label>
            <Input
              id="href"
              value={form.href}
              onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
            />
          </div>
          <ImageUploadField
            label="Image"
            folder="banners"
            value={form.imageUrl}
            onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          />
          <div>
            <Label htmlFor="placement">Placement</Label>
            <Select
              id="placement"
              value={form.placement}
              onChange={(e) =>
                setForm((f) => ({ ...f, placement: e.target.value }))
              }
            >
              {BANNER_PLACEMENTS.map((placement) => (
                <option key={placement} value={placement}>
                  {placement}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="order">Display order</Label>
            <Input
              id="order"
              type="number"
              value={form.displayOrder}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayOrder: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </div>
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
          <AdminEmpty title="No banners yet" />
        ) : (
          <AdminTable headers={["Title", "Placement", "Order", "Actions"]}>
            {items.map((item) => (
              <tr key={item.id} className="text-[13px]">
                <td className="px-4 py-3 font-medium text-ink">{item.title}</td>
                <td className="px-4 py-3 text-muted">{item.placement}</td>
                <td className="px-4 py-3 text-muted">
                  {item.displayOrder ?? 0}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          title: item.title,
                          subtitle: item.subtitle ?? "",
                          ctaLabel: item.ctaLabel ?? "",
                          href: item.href ?? "",
                          imageUrl: item.imageUrl ?? "",
                          placement: String(item.placement ?? "home"),
                          displayOrder: String(item.displayOrder ?? 0),
                          active: item.active !== false,
                          startDate: "",
                          endDate: "",
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        if (!window.confirm(`Delete ${item.title}?`)) return;
                        void deleteBannerAdmin(item.id, actor).then(reload);
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
