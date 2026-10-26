"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageVisit } from "@/services/visits.service";

let lastTracked: { path: string; at: number } | null = null;

/**
 * Records a visit for each public pathname change. Skips `/admin` routes and
 * suppresses duplicate counts from React strict-mode double effects.
 */
export function PageVisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const now = Date.now();
    if (
      lastTracked &&
      lastTracked.path === pathname &&
      now - lastTracked.at < 10_000
    ) {
      return;
    }
    lastTracked = { path: pathname, at: now };
    void trackPageVisit(pathname);
  }, [pathname]);

  return null;
}
