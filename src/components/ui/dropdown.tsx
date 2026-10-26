"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dropdown({
  label,
  options,
  initial,
  value,
  onChange,
  align = "left",
  className,
  buttonClassName,
}: {
  label?: string;
  options: string[];
  initial?: string;
  value?: string;
  onChange?: (value: string) => void;
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value ?? initial ?? options[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value != null) setSelected(value);
  }, [value]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        className={cn(
          "inline-flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 text-sm text-ink transition-colors hover:border-ink/20",
          buttonClassName,
        )}
      >
        <span className="truncate">
          {label ? <span className="text-muted">{label}: </span> : null}
          <span className="font-medium">{selected}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <ul
          role="listbox"
          className={cn(
            "sb-fade-up absolute z-40 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-line bg-white p-1.5 sb-shadow-soft",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === selected}
                onClick={() => {
                  setSelected(option);
                  onChange?.(option);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  option === selected
                    ? "bg-primary-50 font-medium text-primary-700"
                    : "text-ink-soft hover:bg-soft",
                )}
              >
                {option}
                {option === selected ? <Check className="h-4 w-4" aria-hidden /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
