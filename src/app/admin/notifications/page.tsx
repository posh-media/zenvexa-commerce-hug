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
  broadcastNotificationAdmin,
  createNotificationAdmin,
  listAllNotificationsAdmin,
} from "@/services/admin-notifications.service";
import { useUserStore } from "@/stores/user.store";
import { toastError, toastSuccess } from "@/stores/toast.store";
import type { AppNotification } from "@/types/commerce";

export default function AdminNotificationsPage() {
  const authUser = useUserStore((s) => s.authUser);
  const profile = useUserStore((s) => s.profile);
  const actor = {
    id: authUser?.uid ?? "",
    email: profile?.email ?? authUser?.email ?? undefined,
  };
  const [items, setItems] = useState<AppNotification[]>([]);
  const [form, setForm] = useState({
    mode: "user" as "user" | "broadcast",
    userId: "",
    title: "",
    message: "",
    type: "system",
    href: "",
  });
  const [saving, setSaving] = useState(false);

  const reload = () =>
    listAllNotificationsAdmin().then(setItems).catch(() => undefined);
  useEffect(() => {
    void reload();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!actor.id) return;
    setSaving(true);
    try {
      if (form.mode === "broadcast") {
        const count = await broadcastNotificationAdmin(
          {
            title: form.title.trim(),
            message: form.message.trim(),
            type: form.type,
            href: form.href || undefined,
          },
          actor,
        );
        toastSuccess("Broadcast sent", `${count} notifications created`);
      } else {
        if (!form.userId.trim()) {
          toastError("User id required");
          return;
        }
        await createNotificationAdmin(
          {
            userId: form.userId.trim(),
            title: form.title.trim(),
            message: form.message.trim(),
            type: form.type,
            href: form.href || undefined,
          },
          actor,
        );
        toastSuccess("Notification sent");
      }
      setForm({
        mode: form.mode,
        userId: "",
        title: "",
        message: "",
        type: "system",
        href: "",
      });
      await reload();
    } catch (err) {
      toastError(
        "Send failed",
        err instanceof Error ? err.message : "Could not send notification.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireAdmin permission="notifications:write">
      <AdminPageHeader
        title="Notifications"
        description="Send system, promo or order notifications to users. Broadcast fans out to all profiles."
      />
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-line bg-white p-4"
        >
          <div>
            <Label htmlFor="mode">Audience</Label>
            <Select
              id="mode"
              value={form.mode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  mode: e.target.value as "user" | "broadcast",
                }))
              }
            >
              <option value="user">Individual user</option>
              <option value="broadcast">All users (architecture)</option>
            </Select>
          </div>
          {form.mode === "user" ? (
            <div>
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                required
                value={form.userId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, userId: e.target.value }))
                }
              />
            </div>
          ) : null}
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
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              required
              value={form.message}
              onChange={(e) =>
                setForm((f) => ({ ...f, message: e.target.value }))
              }
              className="min-h-[88px] w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <Select
              id="type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="system">System</option>
              <option value="promo">Promo</option>
              <option value="order">Order</option>
              <option value="account">Account</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="href">Link (optional)</Label>
            <Input
              id="href"
              value={form.href}
              onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Sending…" : "Send notification"}
          </Button>
        </form>

        {!items.length ? (
          <AdminEmpty title="No notifications yet" />
        ) : (
          <AdminTable headers={["Title", "User", "Type", "Read"]}>
            {items.slice(0, 50).map((item) => (
              <tr key={item.id} className="text-[13px]">
                <td className="px-4 py-3 font-medium text-ink">{item.title}</td>
                <td className="px-4 py-3 text-muted">{item.userId}</td>
                <td className="px-4 py-3 text-muted">
                  {item.type ?? item.kind ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {item.read ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </div>
    </RequireAdmin>
  );
}
