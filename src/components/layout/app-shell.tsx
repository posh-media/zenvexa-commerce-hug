"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/mobile-nav";
import { OfflineBanner } from "@/components/commerce/offline-banner";

/** Renders storefront chrome except on `/admin` routes. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return <div className="min-h-screen bg-soft">{children}</div>;
  }

  return (
    <>
      <Header />
      <OfflineBanner />
      <main id="main" className="pb-20 lg:pb-0">
        {children}
      </main>
      <Footer />
      <MobileBottomNav />
      <div className="h-16 lg:hidden" aria-hidden />
    </>
  );
}
