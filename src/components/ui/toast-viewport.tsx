"use client";

import { useEffect } from "react";
import { Toast } from "@/components/ui/toast";
import { useToastStore } from "@/stores/toast.store";

export function ToastViewport() {
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-24 right-4 z-[80] flex w-[min(100%-2rem,24rem)] flex-col gap-3 sm:bottom-8 sm:right-8"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => (
        <ToastAutoDismiss key={item.id} {...item} onClose={() => dismiss(item.id)} />
      ))}
    </div>
  );
}

function ToastAutoDismiss({
  id,
  tone,
  title,
  description,
  durationMs = 4000,
  onClose,
}: {
  id: string;
  tone: "success" | "info" | "warning" | "danger";
  title: string;
  description?: string;
  durationMs?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, id, onClose]);

  return (
    <div className="pointer-events-auto">
      <Toast
        tone={tone}
        title={title}
        description={description}
        onClose={onClose}
      />
    </div>
  );
}
