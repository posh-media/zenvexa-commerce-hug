"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";

/** Lightweight offline banner — no layout redesign. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="sb-container pt-4">
      <Alert
        tone="warning"
        title="You appear to be offline"
        className="items-center"
      >
        <span className="inline-flex items-center gap-2">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
          Catalogue pages may show cached or empty results until your connection
          returns.
        </span>
      </Alert>
    </div>
  );
}
