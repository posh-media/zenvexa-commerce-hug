import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  reviews,
  size = "sm",
  showValue = true,
  className,
}: {
  value: number;
  reviews?: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}) {
  const dims = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" }[size];
  const text = { sm: "text-xs", md: "text-[13px]", lg: "text-sm" }[size];
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className="flex items-center gap-0.5"
        role="img"
        aria-label={`Rated ${value} out of 5`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              dims,
              star <= Math.round(value)
                ? "fill-amber-400 text-amber-400"
                : "fill-line text-line",
            )}
            aria-hidden
          />
        ))}
      </span>
      {showValue ? (
        <span className={cn("font-medium text-ink-soft", text)}>{value.toFixed(1)}</span>
      ) : null}
      {typeof reviews === "number" ? (
        <span className={cn("text-muted", text)}>({reviews.toLocaleString()})</span>
      ) : null}
    </div>
  );
}

export function RatingBar({
  stars,
  count,
  total,
}: {
  stars: number;
  count: number;
  total: number;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-xs text-muted">{stars} star</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-soft">
        <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right text-xs text-muted">{pct}%</span>
    </div>
  );
}
