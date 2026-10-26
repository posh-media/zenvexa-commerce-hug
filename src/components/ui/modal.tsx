"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ModalShell({
  title,
  description,
  footer,
  onClose,
  children,
  className,
}: {
  title: string;
  description?: string;
  footer?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cn(
        "sb-fade-up w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-white sb-shadow-hover",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line p-6">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted transition-colors hover:bg-soft hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {children ? <div className="p-6">{children}</div> : null}
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-soft/50 p-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg">{children}</div>
    </div>
  );
}

export function ModalTrigger({
  label,
  variantClass = "border border-line bg-white text-ink hover:bg-soft",
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  children,
}: {
  label: string;
  variantClass?: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors",
          variantClass,
        )}
      >
        {label}
      </button>
      <Modal open={open} onClose={close}>
        <ModalShell
          title={title}
          description={description}
          onClose={close}
          footer={
            <>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-11 items-center rounded-full border border-line bg-white px-5 text-sm font-medium text-ink transition-colors hover:bg-soft"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
              >
                {confirmLabel}
              </button>
            </>
          }
        >
          {children}
        </ModalShell>
      </Modal>
    </>
  );
}
