"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/stores/user.store";

/** Redirect anonymous users to login while keeping the intended destination. */
export function RequireAuth({
  children,
  redirectTo = "/login",
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const status = useUserStore((state) => state.status);

  useEffect(() => {
    if (status === "anonymous") {
      const next =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/profile";
      router.replace(
        `${redirectTo}?next=${encodeURIComponent(next || "/profile")}`,
      );
    }
  }, [redirectTo, router, status]);

  if (status === "loading") {
    return (
      <div className="sb-container py-16 text-center text-sm text-muted">
        Checking your session…
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="sb-container py-16 text-center text-sm text-muted">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}
