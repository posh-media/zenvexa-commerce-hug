import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";

const config: Record<Tone, { wrap: string; icon: React.ReactNode }> = {
  info: {
    wrap: "border-sky-100 bg-sky-50/70 text-sky-900",
    icon: <Info className="h-5 w-5 text-sky-600" aria-hidden />,
  },
  success: {
    wrap: "border-emerald-100 bg-emerald-50/70 text-emerald-900",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />,
  },
  warning: {
    wrap: "border-amber-100 bg-amber-50/70 text-amber-900",
    icon: <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />,
  },
  danger: {
    wrap: "border-primary-100 bg-primary-50/70 text-primary-900",
    icon: <XCircle className="h-5 w-5 text-primary" aria-hidden />,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { wrap, icon } = config[tone];
  return (
    <div
      role="status"
      className={cn("flex items-start gap-3 rounded-2xl border p-4", wrap, className)}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children ? (
          <div className="mt-1 text-[13px] leading-relaxed opacity-90">{children}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
