import { cn } from "@/lib/utils";

export function EmptyState({
  illustration,
  title,
  description,
  actions,
  className,
  compact = false,
}: {
  illustration: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-line bg-white text-center",
        compact ? "px-6 py-10" : "px-6 py-16 sm:py-20",
        className,
      )}
    >
      <div className={cn("mb-6", compact ? "w-32" : "w-48 sm:w-56")}>{illustration}</div>
      <h3 className="text-lg font-semibold tracking-[-0.02em] text-ink sm:text-xl">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {actions ? (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
