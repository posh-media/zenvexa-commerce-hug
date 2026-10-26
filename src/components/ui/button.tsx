import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "subtle" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 ease-premium disabled:pointer-events-none disabled:opacity-45 active:scale-[0.985] whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-600 shadow-[0_8px_20px_-10px_rgba(20,92,67,0.35)]",
  secondary: "bg-ink text-white hover:bg-ink-soft",
  outline: "border border-line bg-white text-ink hover:border-ink/25 hover:bg-soft",
  ghost: "text-ink hover:bg-soft",
  subtle: "bg-primary-50 text-primary-700 hover:bg-primary-100",
  danger: "border border-primary-200 bg-white text-primary-700 hover:bg-primary-50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-[52px] px-7 text-[15px]",
  icon: "h-11 w-11",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: React.ReactNode;
};

export function buttonClass({ variant = "primary", size = "md", className }: CommonProps) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  children,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={buttonClass({ variant, size, className })} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  children,
  href,
  ...rest
}: CommonProps & React.ComponentProps<typeof Link>) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}

export function IconButton({
  className,
  label,
  children,
  ...rest
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-all duration-200 hover:border-ink/20 hover:bg-soft",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
