import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
export function Logo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <Link href="/" aria-label="Zenvexa home" className={cn("brand", className)}>
      <span className="brand-icon">
        <ShoppingBag aria-hidden="true" />
      </span>
      <span>
        <span className={cn("brand-name", tone === "light" && "!text-white")}>
          Zenvexa<span className="ng-badge">NG</span>
        </span>
        <span className="brand-tagline block">
          Everything Naija Needs. One Warm Hug.
        </span>
      </span>
    </Link>
  );
}
