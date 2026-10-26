"use client";

import { useMemo, useState } from "react";
import {
  BellRing,
  CheckCheck,
  Package,
  Percent,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NoBellIllustration } from "@/components/ui/illustrations";
import { cn } from "@/lib/utils";
import {
  deleteNotification,
  listNotificationsByUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications.service";
import { useNotificationsStore } from "@/stores/notifications.store";
import { useUserStore } from "@/stores/user.store";
import type { AppNotification } from "@/types/commerce";

function iconFor(type?: string) {
  if (type === "order") return Package;
  if (type === "promo") return Percent;
  if (type === "wishlist") return Sparkles;
  return BellRing;
}

function NotificationsContent() {
  const uid = useUserStore((state) => state.authUser?.uid);
  const items = useNotificationsStore((state) => state.items);
  const setItems = useNotificationsStore((state) => state.setItems);
  const setUnreadCount = useNotificationsStore((state) => state.setUnreadCount);
  const [filter, setFilter] = useState<"all" | "unread" | "order" | "promo">(
    "all",
  );

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((item) => !item.read);
    return items.filter((item) => item.type === filter || item.kind === filter);
  }, [filter, items]);

  const refresh = async () => {
    if (!uid) return;
    const list = await listNotificationsByUser(uid);
    setItems(list);
    setUnreadCount(list.filter((item) => !item.read).length);
  };

  const markRead = async (item: AppNotification) => {
    if (item.read) return;
    await markNotificationRead(item.id);
    await refresh();
  };

  const markAll = async () => {
    if (!uid) return;
    await markAllNotificationsRead(uid);
    await refresh();
  };

  const remove = async (id: string) => {
    await deleteNotification(id);
    await refresh();
  };

  const filters = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "order", label: "Orders" },
    { id: "promo", label: "Promotions" },
  ] as const;

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Notifications" }]}
        title="Notifications"
        description="Order updates, promotions and system messages."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void markAll()}>
              <CheckCheck className="h-4 w-4" aria-hidden />
              Mark all read
            </Button>
            <ButtonLink href="/settings" variant="ghost" size="sm">
              <Settings className="h-4 w-4" aria-hidden />
              Preferences
            </ButtonLink>
          </div>
        }
      />

      <div
        role="tablist"
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line"
      >
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-all",
              filter === item.id
                ? "border-primary text-ink"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <div className="mt-6">
          <EmptyState
            illustration={<NoBellIllustration />}
            title="You're all caught up"
            description="Order and promo notifications will appear here."
            actions={<ButtonLink href="/products">Continue shopping</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-2xl border border-line bg-white">
          {filtered.map((item) => {
            const Icon = iconFor(item.type ?? item.kind);
            const unread = !item.read;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-4 border-b border-line p-5 last:border-b-0",
                  unread ? "bg-primary-50/40" : "bg-white hover:bg-soft/50",
                )}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                    unread ? "bg-primary text-white" : "bg-soft text-ink",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        "text-[15px] tracking-[-0.01em]",
                        unread
                          ? "font-semibold text-ink"
                          : "font-medium text-ink-soft",
                      )}
                    >
                      {item.title}
                    </p>
                    {unread ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                    {item.message ?? item.body}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Badge tone="outline">
                      {item.type ?? item.kind ?? "system"}
                    </Badge>
                    {item.href ? (
                      <ButtonLink href={item.href} variant="ghost" size="sm">
                        View
                      </ButtonLink>
                    ) : null}
                    {unread ? (
                      <button
                        type="button"
                        className="text-[13px] font-medium text-primary hover:underline"
                        onClick={() => void markRead(item)}
                      >
                        Mark read
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-primary"
                      onClick={() => void remove(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsContent />
    </RequireAuth>
  );
}
