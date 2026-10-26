import type { Metadata } from "next";
import { Flame, Percent, Timer, Zap } from "lucide-react";
import { discountPercent, formatPrice } from "@/lib/utils";
import { toProductViews } from "@/lib/product-view";
import { buildListingMetadata } from "@/lib/seo";
import {
  getBestSellers,
  getDiscountedProducts,
  getFeaturedProducts,
  getFlashSaleProducts,
  getLatestProducts,
  getSponsoredProducts,
  getTrendingProducts,
} from "@/services/products.service";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/commerce/countdown";
import { endOfTodayISO } from "@/lib/datetime";
import { ProductCard } from "@/components/commerce/product-card";
import { ProductMedia } from "@/components/commerce/product-media";
import { CatalogEmpty, CatalogError } from "@/components/commerce/catalog-state";
import { RecentlyViewedRail } from "@/components/commerce/recently-viewed";

const flashEndsAt = endOfTodayISO();

export const metadata: Metadata = buildListingMetadata({
  title: "Deals",
  description:
    "Flash sales, featured, trending, best sellers and discounted products from Zenvexa.",
  path: "/deals",
});

export const revalidate = 60;

function ProductSection({
  eyebrow,
  title,
  description,
  items,
  empty,
  failed,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  items: ReturnType<typeof toProductViews>;
  empty: string;
  failed: boolean;
  action?: React.ReactNode;
}) {
  return (
    <section className="pt-16 sm:pt-20">
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={action}
      />
      {failed ? <CatalogError /> : null}
      {!failed && !items.length ? <CatalogEmpty description={empty} /> : null}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export default async function DealsPage() {
  type Items = ReturnType<typeof toProductViews>;
  let flash: Items = [];
  let featured: Items = [];
  let trending: Items = [];
  let bestsellers: Items = [];
  let sponsored: Items = [];
  let discounted: Items = [];
  let latest: Items = [];
  let failed = false;

  try {
    const [
      flashSale,
      featuredProducts,
      trendingProducts,
      bestSellerProducts,
      sponsoredProducts,
      deals,
      recent,
    ] = await Promise.all([
      getFlashSaleProducts(8),
      getFeaturedProducts(8),
      getTrendingProducts(8),
      getBestSellers(8),
      getSponsoredProducts(8),
      getDiscountedProducts(24),
      getLatestProducts(8),
    ]);
    flash = toProductViews(flashSale);
    featured = toProductViews(featuredProducts);
    trending = toProductViews(trendingProducts);
    bestsellers = toProductViews(bestSellerProducts);
    sponsored = toProductViews(sponsoredProducts);
    discounted = toProductViews(deals);
    latest = toProductViews(recent);
  } catch {
    failed = true;
  }

  const headline = discounted[0] as Items[number] | undefined;

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Deals" }]}
        title="Deals"
        description="Flash sales, clearance and limited offers — powered by the live catalogue."
      />

      <section className="relative overflow-hidden rounded-3xl bg-ink p-7 text-white sm:p-10">
        <span
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
              <Zap className="h-3 w-3" aria-hidden />
              Flash sale live
            </p>
            <h2 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-display-sm">
              Limited-time savings across the catalogue
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/65">
              Every section below is loaded from Firestore product flags and
              discounts.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink href="/products">Shop the sale</ButtonLink>
            </div>
          </div>
          <div className="shrink-0">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
              <Timer className="h-3.5 w-3.5" aria-hidden />
              Ends in
            </p>
            <Countdown tone="dark" endsAt={flashEndsAt} />
          </div>
        </div>
      </section>

      <section className="pt-16 sm:pt-20">
        <SectionHeading
          eyebrow="Deal of the day"
          title="One product, one price, until midnight"
        />
        {failed ? <CatalogError /> : null}
        {!failed && !headline ? (
          <CatalogEmpty description="No discounted products are available right now." />
        ) : null}
        {headline ? (
          <Card padded={false} className="overflow-hidden">
            <div className="grid gap-0 lg:grid-cols-[1fr_1.2fr]">
              <ProductMedia
                icon={headline.icon}
                tone={headline.tone}
                name={headline.name}
                src={headline.thumbnail ?? headline.images?.[0]}
                className="aspect-[4/3] w-full rounded-none lg:aspect-auto lg:h-full"
              />
              <div className="p-7 sm:p-10">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="primary">
                    <Flame className="h-3 w-3" aria-hidden />
                    Save {discountPercent(headline.price, headline.oldPrice)}%
                  </Badge>
                  <Badge tone="outline">{headline.brand}</Badge>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-ink">
                  {headline.name}
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">
                  {headline.shortDescription}
                </p>
                <div className="mt-6 flex flex-wrap items-end gap-3">
                  <span className="text-3xl font-semibold tracking-[-0.03em] text-ink">
                    {formatPrice(headline.price)}
                  </span>
                  {headline.oldPrice ? (
                    <span className="text-lg text-muted line-through">
                      {formatPrice(headline.oldPrice)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <ButtonLink href={`/product/${headline.slug}`} size="lg">
                    View deal
                  </ButtonLink>
                  <Countdown showLabels={false} endsAt={flashEndsAt} />
                </div>
              </div>
            </div>
          </Card>
        ) : null}
      </section>

      <ProductSection
        eyebrow="Ends tonight"
        title="Flash sale"
        items={flash}
        empty="No flash sale products are live right now."
        failed={failed}
        action={<Countdown showLabels={false} endsAt={flashEndsAt} />}
      />
      <ProductSection
        eyebrow="Editor picks"
        title="Featured products"
        items={featured}
        empty="No featured products right now."
        failed={failed}
      />
      <ProductSection
        eyebrow="Popular now"
        title="Trending"
        items={trending}
        empty="No trending products right now."
        failed={failed}
      />
      <ProductSection
        eyebrow="Customer favourites"
        title="Best sellers"
        items={bestsellers}
        empty="No best sellers flagged yet."
        failed={failed}
      />
      <ProductSection
        eyebrow="Partner stores"
        title="Sponsored"
        items={sponsored}
        empty="No sponsored products right now."
        failed={failed}
      />
      <ProductSection
        eyebrow="Clearance"
        title="Discounted products"
        description={`${discounted.length} products currently below their usual price.`}
        items={discounted}
        empty="No discounted products right now."
        failed={failed}
        action={
          <Badge tone="outline" className="hidden sm:inline-flex">
            <Percent className="h-3 w-3" aria-hidden />
            On sale
          </Badge>
        }
      />
      <ProductSection
        eyebrow="Just in"
        title="Recently added"
        items={latest}
        empty="No recent products found."
        failed={failed}
      />

      <RecentlyViewedRail />
    </div>
  );
}
