"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { RequireAdmin } from "@/components/auth/require-admin";
import { ADMIN_NAV, hasPermission } from "@/lib/admin/rbac";
import { signOutUser } from "@/services/auth.service";
import { useUserStore } from "@/stores/user.store";
import { Logo } from "@/components/layout/logo";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profile = useUserStore((s) => s.profile);
  const links = ADMIN_NAV.filter((item) =>
    hasPermission(profile?.role, item.permission),
  );
  return (
    <RequireAdmin>
      <div className="min-h-screen bg-soft">
        <header className="zv-admin-header">
          <div className="container-page flex min-h-24 flex-wrap items-center gap-4 py-4">
            <Logo tone="light" />
            <span className="admin-pill">Admin Portal</span>
            <div className="ml-auto flex gap-2">
              <Link href="/" className="zv-button glass">
                <ArrowLeft />
                Storefront
              </Link>
              <button
                type="button"
                className="zv-button amber"
                onClick={() => void signOutUser()}
              >
                <LogOut />
                Sign out
              </button>
            </div>
          </div>
        </header>
        <div className="container-page">
          <nav className="zv-admin-nav" aria-label="Admin navigation">
            {links.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4 text-xs text-muted">
            <span className="page-eyebrow !mb-0">Zenvexa operations</span>
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} />
              {profile?.displayName || profile?.email || "Staff"} ·{" "}
              {profile?.role?.replaceAll("_", " ")}
            </span>
          </div>
          <main id="main" className="zv-admin-main">
            {children}
          </main>
        </div>
      </div>
    </RequireAdmin>
  );
}
