"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  count?: number;
  content: React.ReactNode;
};

export function Tabs({
  items,
  className,
  variant = "underline",
}: {
  items: TabItem[];
  className?: string;
  variant?: "underline" | "pill";
}) {
  const [active, setActive] = useState(items[0]?.id);
  const current = items.find((item) => item.id === active) ?? items[0];

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Content sections"
        className={cn(
          "no-scrollbar flex gap-1 overflow-x-auto",
          variant === "underline" && "border-b border-line",
          variant === "pill" && "rounded-full border border-line bg-white p-1",
        )}
      >
        {items.map((item) => {
          const isActive = item.id === current?.id;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => setActive(item.id)}
              className={cn(
                "shrink-0 whitespace-nowrap text-sm font-medium transition-all duration-200",
                variant === "underline" &&
                  cn(
                    "-mb-px border-b-2 px-4 py-3",
                    isActive
                      ? "border-primary text-ink"
                      : "border-transparent text-muted hover:text-ink",
                  ),
                variant === "pill" &&
                  cn(
                    "rounded-full px-4 py-2",
                    isActive ? "bg-ink text-white" : "text-muted hover:bg-soft hover:text-ink",
                  ),
              )}
            >
              {item.label}
              {typeof item.count === "number" ? (
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    isActive ? "bg-primary-50 text-primary-700" : "bg-soft text-muted",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-6 sb-fade-up" key={current?.id}>
        {current?.content}
      </div>
    </div>
  );
}
