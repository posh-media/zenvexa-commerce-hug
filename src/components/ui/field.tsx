import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-line bg-white px-4 text-sm text-ink placeholder:text-muted-foreground transition-colors duration-200 hover:border-ink/20 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:bg-soft disabled:text-muted";

export function Label({
  className,
  children,
  htmlFor,
  hint,
}: {
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <label
        htmlFor={htmlFor}
        className={cn("text-[13px] font-medium text-ink", className)}
      >
        {children}
      </label>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Input({
  className,
  icon,
  ...rest
}: { icon?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  if (icon) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          {icon}
        </span>
        <input className={cn(control, "h-12 pl-11", className)} {...rest} />
      </div>
    );
  }
  return <input className={cn(control, "h-12", className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-[120px] py-3", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(control, "h-12 appearance-none pr-11", className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}

export function Checkbox({
  label,
  count,
  className,
  ...rest
}: { label: React.ReactNode; count?: number } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 py-1.5 text-sm text-ink-soft",
        className,
      )}
    >
      <input
        type="checkbox"
        className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[6px] border-line text-primary accent-primary focus:ring-primary-100"
        {...rest}
      />
      <span className="flex-1">{label}</span>
      {typeof count === "number" ? (
        <span className="text-xs text-muted">{count}</span>
      ) : null}
    </label>
  );
}

export function Radio({
  label,
  description,
  className,
  ...rest
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 transition-colors duration-200 hover:border-ink/20 has-[:checked]:border-primary has-[:checked]:bg-primary-50/40",
        className,
      )}
    >
      <input
        type="radio"
        className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer border-line text-primary accent-primary"
        {...rest}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[13px] text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function Toggle({
  label,
  description,
  defaultChecked,
  name,
}: {
  label: string;
  description?: string;
  defaultChecked?: boolean;
  name?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6 py-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-1 block text-[13px] leading-relaxed text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer h-6 w-11 cursor-pointer appearance-none rounded-full bg-line transition-colors duration-200 checked:bg-primary"
        />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
