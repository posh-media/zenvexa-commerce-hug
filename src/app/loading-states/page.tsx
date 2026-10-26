import type { Metadata } from "next";
import { buildPrivateMetadata } from "@/lib/seo";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  CheckoutSkeleton,
  ListRowSkeleton,
  ProductCardSkeleton,
  ProductGridSkeleton,
  ProfileSkeleton,
  SearchSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export const metadata: Metadata = buildPrivateMetadata("Loading states");

function Block({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-12 first:pt-0">
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
        <p className="mt-1 text-[13px] text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function LoadingStatesPage() {
  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Design system", href: "/components" },
          { label: "Loading states" },
        ]}
        title="Loading states"
        description="Skeletons match the layout of the content they replace, so nothing shifts when data lands."
      />

      <Block
        title="Product cards"
        description="Used on the home rails, listing grid, category and search pages."
      >
        <ProductGridSkeleton count={8} />
      </Block>

      <Block title="Single product card" description="The atom used by every grid.">
        <div className="max-w-[260px]">
          <ProductCardSkeleton />
        </div>
      </Block>

      <Block
        title="Product details"
        description="Gallery, buy box and specification table while the product loads."
      >
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex gap-4">
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="aspect-square flex-1 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-4/5" />
            <Skeleton className="h-8 w-2/5" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-40" />
            <div className="flex gap-3 pt-4">
              <Skeleton className="h-12 w-32 rounded-full" />
              <Skeleton className="h-12 flex-1 rounded-full" />
            </div>
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </Block>

      <Block title="Checkout" description="Address, shipping, payment and the summary rail.">
        <CheckoutSkeleton />
      </Block>

      <Block title="Orders" description="Order history rows and the invoice table.">
        <div className="space-y-4">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <TableSkeleton rows={4} />
        </div>
      </Block>

      <Block title="Profile" description="Profile header and the stat cards below it.">
        <ProfileSkeleton />
      </Block>

      <Block
        title="Search"
        description="Search bar, suggestion chips and the first row of results."
      >
        <SearchSkeleton />
      </Block>

      <Block title="Inline loaders" description="Spinner, progress bar and button states.">
        <Card className="flex flex-wrap items-center gap-8">
          <div className="flex items-center gap-3">
            <span
              className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-primary"
              aria-hidden
            />
            <span className="text-[13px] text-muted">Spinner</span>
          </div>
          <div className="min-w-[200px] flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-soft">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
            <p className="mt-2 text-[13px] text-muted">Determinate progress — 66%</p>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-white opacity-70"
          >
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden
            />
            Placing order…
          </button>
        </Card>
      </Block>
    </div>
  );
}
