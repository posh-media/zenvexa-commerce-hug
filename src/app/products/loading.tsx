import { ProductGridSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="sb-container">
      <div className="space-y-4 pt-6 sm:pt-8">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="mb-8 mt-8 max-w-2xl">
        <Skeleton className="h-12 w-full rounded-full" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[276px_1fr]">
        <aside className="hidden lg:block">
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        </aside>
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}
