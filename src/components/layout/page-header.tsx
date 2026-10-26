import { Breadcrumb, type Crumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export function PageHeader({
  crumbs,
  title,
  description,
  action,
  className,
}: {
  crumbs?: Crumb[];
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pb-8 pt-6 sm:pt-8", className)}>
      {crumbs ? <Breadcrumb items={crumbs} className="mb-5" /> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-ink sm:text-display-sm">
            {title}
          </h1>
          {description ? (
            <p className="mt-2.5 text-[15px] leading-relaxed text-muted sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
    </div>
  );
}
