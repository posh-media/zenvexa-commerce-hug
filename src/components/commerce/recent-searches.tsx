"use client";

import Link from "next/link";
import { Clock, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSearchStore } from "@/stores/search.store";

/** Client-side recent searches from the global search store. */
export function RecentSearchesCard() {
  const recent = useSearchStore((state) => state.recent);
  const removeRecent = useSearchStore((state) => state.removeRecent);
  const hydrated = useSearchStore((state) => state.hydrated);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Clock className="h-4 w-4 text-muted" aria-hidden />
          Recent searches
        </h2>
      </div>
      {!hydrated ? (
        <p className="mt-4 text-[13px] text-muted">Loading…</p>
      ) : !recent.length ? (
        <p className="mt-4 text-[13px] text-muted">
          Your recent searches will appear here.
        </p>
      ) : (
        <ul className="mt-4 space-y-1">
          {recent.map((term) => (
            <li key={term} className="flex items-center gap-2">
              <Link
                href={`/search?q=${encodeURIComponent(term)}`}
                className="flex-1 rounded-lg px-2 py-2 text-sm text-ink-soft transition-colors hover:bg-soft"
              >
                {term}
              </Link>
              <button
                type="button"
                aria-label={`Remove ${term} from recent searches`}
                onClick={() => removeRecent(term)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
