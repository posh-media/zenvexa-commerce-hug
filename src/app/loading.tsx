import { ProductGridSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="sb-container">
      <div className="grid gap-4 pt-6 lg:grid-cols-[1.55fr_1fr] lg:pt-8">
        <Skeleton className="h-[420px] w-full rounded-3xl" />
        <div className="grid gap-4">
          <Skeleton className="h-[250px] w-full rounded-3xl" />
          <Skeleton className="h-[154px] w-full rounded-3xl" />
        </div>
      </div>
      <div className="space-y-4 pt-16 sm:pt-20">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72" />
        <ProductGridSkeleton count={4} />
      </div>
    </div>
  );
}
