import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Category } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ProductIcon } from "@/components/commerce/product-media";

export function CategoryCard({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  return (
    <Link
      href={`/category/${category.slug}`}
      className={cn(
        "group flex flex-col items-start gap-4 rounded-2xl border border-line bg-white p-5 transition-all duration-300 ease-premium hover:-translate-y-1 hover:border-transparent hover:sb-shadow-hover",
        className,
      )}
    >
      <span
        className={cn(
          "grid h-14 w-14 place-items-center rounded-xl transition-transform duration-300 ease-premium group-hover:scale-105",
          category.tone,
        )}
      >
        <ProductIcon icon={category.icon} className="h-6 w-6 text-ink" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {category.name}
          <ArrowUpRight className="h-4 w-4 text-muted transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
        </span>
        <span className="mt-1 block text-[13px] text-muted">
          {category.itemCount.toLocaleString()} products
        </span>
      </span>
    </Link>
  );
}

export function CategoryTile({ category }: { category: Category }) {
  return (
    <Link
      href={`/category/${category.slug}`}
      className="group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl border border-line p-5 transition-all duration-300 ease-premium hover:border-transparent hover:sb-shadow-hover"
    >
      <span className={cn("absolute inset-0", category.tone)} aria-hidden />
      <span className="relative flex items-start justify-between">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {category.name}
        </span>
        <ProductIcon
          icon={category.icon}
          className="h-9 w-9 text-ink/60 transition-transform duration-500 ease-premium group-hover:scale-110"
        />
      </span>
      <span className="relative">
        <span className="block text-[13px] leading-relaxed text-ink/60">
          {category.description}
        </span>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
          Shop now
          <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}
