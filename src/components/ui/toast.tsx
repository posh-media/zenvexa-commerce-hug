"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "info" | "warning" | "danger";

const icons: Record<Tone, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />,
  info: <Info className="h-5 w-5 text-sky-500" aria-hidden />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />,
  danger: <XCircle className="h-5 w-5 text-primary" aria-hidden />,
};

export function Toast({
  tone = "success",
  title,
  description,
  onClose,
  className,
}: {
  tone?: Tone;
  title: string;
  description?: string;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "sb-fade-up flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-white p-4 sb-shadow-soft",
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{icons[tone]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onClose}
        className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function ToastDemo({
  tone = "success",
  title,
  description,
  label = "Show toast",
}: {
  tone?: Tone;
  title: string;
  description?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), 4000);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-medium text-ink transition-colors hover:bg-soft"
      >
        {label}
      </button>
      {open ? (
        <div className="fixed bottom-24 right-4 z-[60] sm:bottom-8 sm:right-8">
          <Toast
            tone={tone}
            title={title}
            description={description}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </>
  );
}
