"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/user.store";
import {
  canAccessAdmin,
  hasPermission,
  type AdminPermission,
} from "@/lib/admin/rbac";

/** Protect admin routes — auth + staff role (+ optional permission). */
export function RequireAdmin({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: AdminPermission;
}) {
  const router = useRouter();
  const status = useUserStore((state) => state.status);
  const profile = useUserStore((state) => state.profile);
  const role = profile?.role;

  useEffect(() => {
    if (status === "anonymous") {
      const next =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/admin";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (status === "authenticated" && !canAccessAdmin(role)) {
      router.replace("/");
    }
  }, [role, router, status]);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted">
        Checking admin access…
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted">
        Redirecting to sign in…
      </div>
    );
  }

  if (!canAccessAdmin(role)) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted">
        You do not have permission to access the admin dashboard.
      </div>
    );
  }

  if (permission && !hasPermission(role, permission)) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-ink">Access denied</h1>
        <p className="mt-2 text-sm text-muted">
          Your role ({role}) cannot access this section.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
