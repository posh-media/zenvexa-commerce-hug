import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "ink" | "neutral" | "success" | "warning" | "info" | "outline";

const tones: Record<Tone, string> = {
  primary: "bg-primary text-white",
  ink: "bg-ink text-white",
  neutral: "bg-soft text-ink-soft",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-700",
  outline: "border border-line bg-white text-ink-soft",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Tag({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Chip({
  active,
  onRemove,
  className,
  children,
  ...rest
}: {
  active?: boolean;
  onRemove?: () => void;
  className?: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all duration-200",
        active
          ? "border-primary bg-primary text-white"
          : "border-line bg-white text-ink-soft hover:border-ink/20 hover:bg-soft",
        className,
      )}
      {...rest}
    >
      {children}
      {onRemove ? <X className="h-3.5 w-3.5" aria-hidden /> : null}
    </button>
  );
}

export function StatusDot({ tone }: { tone: "success" | "warning" | "danger" | "info" }) {
  const map = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-primary",
    info: "bg-sky-500",
  };
  return <span className={cn("h-2 w-2 rounded-full", map[tone])} aria-hidden />;
}
