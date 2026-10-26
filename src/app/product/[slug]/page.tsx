import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Check,
  CreditCard,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { discountPercent, formatPrice } from "@/lib/utils";
import {
  ratingBreakdown as buildRatingBreakdown,
  toProductView,
  toProductViews,
  toReviewViews,
} from "@/lib/product-view";
import {
  breadcrumbJsonLd,
  buildProductMetadata,
  JsonLd,
  productJsonLd,
} from "@/lib/seo";
import {
  getActiveProducts,
  getProductBySlug,
} from "@/services/products.service";
import { getRecommendationsForProduct } from "@/services/recommendations.service";
import { productDetailCrumbs } from "@/lib/breadcrumbs";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rating, RatingBar } from "@/components/ui/rating";
import { Tabs } from "@/components/ui/tabs";
import { Countdown } from "@/components/commerce/countdown";
import { endOfTodayISO } from "@/lib/datetime";
import {
  LazyProductGallery,
  LazyProductPurchasePanel,
} from "@/components/commerce/lazy-product-detail";
import { TrackableProductCard } from "@/components/commerce/trackable-product-card";
import {
  RecentlyViewedRail,
  TrackProductView,
} from "@/components/commerce/recently-viewed";

export const revalidate = 60;
export const dynamicParams = true;

/** Prerender what the catalogue holds at build time; anything else is on-demand. */
export async function generateStaticParams() {
  try {
    const products = await getActiveProducts(48);
    return products.map((product) => ({ slug: product.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product) return { title: "Product not found" };
  return buildProductMetadata(product);
}

const perks = [
  { icon: Truck, title: "Free next-day delivery", body: "Order today, arrives tomorrow" },
  { icon: RotateCcw, title: "30-day returns", body: "Prepaid label included" },
  { icon: ShieldCheck, title: "2 year cover", body: "Handled in-house" },
  { icon: CreditCard, title: "Pay in 3", body: "0% interest, no fees" },
];

export default async function ProductDetailsPage({
  params,
}: {
  params: { slug: string };
}) {
  const source = await getProductBySlug(params.slug);
  if (!source) notFound();

  const product = toProductView(source);
  const reviews = toReviewViews(source);
  const ratingBreakdown = buildRatingBreakdown(reviews);
  const off = discountPercent(product.price, product.oldPrice);
  const totalReviews = ratingBreakdown.reduce((sum, row) => sum + row.count, 0);
  const relatedSource = await getRecommendationsForProduct(source, {
    related: 4,
    alsoLike: 4,
  });
  const related = toProductViews(relatedSource.related);
  const alsoLike = toProductViews(relatedSource.alsoLike);

  const breadcrumbItems = productDetailCrumbs({
    categoryName: product.category,
    categorySlug: product.categoryId || undefined,
    productName: product.name,
  });
  const isFlash = product.tags.includes("flash-sale");
  const flashEndsAt = endOfTodayISO();

  return (
    <div className="sb-container">
      <JsonLd data={productJsonLd(source)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          {
            name: product.category,
            path: product.categoryId
              ? `/category/${product.categoryId}`
              : "/products",
          },
          { name: product.name },
        ])}
      />
      <TrackProductView
        product={product}
        categoryId={product.categoryId}
        brandId={product.brandId}
      />

      <div className="pt-6 sm:pt-8">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      <div className="grid gap-8 pt-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <LazyProductGallery
          icon={product.icon}
          tone={product.tone}
          name={product.name}
          images={product.images ?? (product.thumbnail ? [product.thumbnail] : [])}
        />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={
                product.brandId ? `/products?brand=${product.brandId}` : "/brands"
              }
              className="text-[13px] font-semibold uppercase tracking-[0.1em] text-primary hover:underline"
            >
              {product.brand}
            </Link>
            {product.officialStore ? <Badge tone="success">Official store</Badge> : null}
            {product.sponsored ? <Badge tone="ink">Sponsored</Badge> : null}
            {product.badge &&
            product.badge !== "Official store" &&
            product.badge !== "Sponsored" ? (
              <Badge tone="ink">{product.badge}</Badge>
            ) : null}
          </div>

          <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[34px]">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Rating value={product.rating} size="md" />
            <a href="#reviews" className="text-[13px] text-muted hover:text-primary">
              {product.reviews.toLocaleString()} reviews
            </a>
            <span className="text-line" aria-hidden>
              |
            </span>
            <span className="text-[13px] text-muted">
              SKU {product.sku ?? product.id}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <span className="text-[32px] font-semibold tracking-[-0.03em] text-ink">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice ? (
              <>
                <span className="text-lg text-muted line-through">
                  {formatPrice(product.oldPrice)}
                </span>
                <Badge tone="primary">Save {off}%</Badge>
              </>
            ) : null}
          </div>
          <p className="mt-2 text-[13px] text-muted">
            Or {formatPrice(Math.round(product.price / 3))}/month for 3 months, interest free.
          </p>

          {isFlash ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge tone="primary">Flash sale</Badge>
              <Countdown endsAt={flashEndsAt} showLabels={false} />
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-2">
            {product.stock > 5 ? (
              <Badge tone="success">
                <Check className="h-3 w-3" aria-hidden />
                In stock — ships today
              </Badge>
            ) : (
              <Badge tone="warning">Only {product.stock} left in stock</Badge>
            )}
            <Badge tone="outline">
              <Package className="h-3 w-3" aria-hidden />
              Sold by Zenvexa
            </Badge>
          </div>

          <p className="mt-6 text-[15px] leading-relaxed text-muted">
            {product.shortDescription}
          </p>

          <LazyProductPurchasePanel product={product} />

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {perks.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="flex items-start gap-3 rounded-xl border border-line p-3.5"
              >
                <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="block text-[13px] font-medium text-ink">{title}</span>
                  <span className="block text-[12px] text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section id="reviews" className="pt-16 sm:pt-20">
        <Tabs
          items={[
            {
              id: "description",
              label: "Description",
              content: (
                <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
                  <div>
                    <p className="text-[15px] leading-[1.75] text-muted">
                      {product.description}
                    </p>
                    <h3 className="mt-8 text-[15px] font-semibold text-ink">
                      What stands out
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {product.highlights.map((highlight) => (
                        <li key={highlight} className="flex items-start gap-3 text-[15px] text-muted">
                          <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary" aria-hidden />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Card className="bg-soft/50">
                    <h3 className="text-[15px] font-semibold text-ink">In the box</h3>
                    <ul className="mt-4 space-y-2.5 text-[14px] text-muted">
                      <li>{product.name}</li>
                      <li>USB-C charge cable (1m)</li>
                      <li>Quick start guide</li>
                      <li>Zenvexa 2-year warranty card</li>
                    </ul>
                  </Card>
                </div>
              ),
            },
            {
              id: "specs",
              label: "Specifications",
              content: (
                <div className="overflow-hidden rounded-2xl border border-line">
                  <dl className="divide-y divide-line">
                    {product.specs.map((spec) => (
                      <div
                        key={spec.label}
                        className="grid gap-1 px-5 py-4 sm:grid-cols-[240px_1fr] sm:gap-6"
                      >
                        <dt className="text-[13px] font-medium uppercase tracking-[0.06em] text-muted">
                          {spec.label}
                        </dt>
                        <dd className="text-[15px] text-ink">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ),
            },
            {
              id: "reviews",
              label: "Reviews",
              count: product.reviews,
              content: (
                <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
                  <Card className="h-fit">
                    <p className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-ink">
                      {product.rating.toFixed(1)}
                    </p>
                    <Rating value={product.rating} showValue={false} size="lg" className="mt-3" />
                    <p className="mt-2 text-[13px] text-muted">
                      Based on {totalReviews.toLocaleString()} verified reviews
                    </p>
                    <div className="mt-6 space-y-2.5">
                      {ratingBreakdown.map((row) => (
                        <RatingBar
                          key={row.stars}
                          stars={row.stars}
                          count={row.count}
                          total={totalReviews}
                        />
                      ))}
                    </div>
                    <Button variant="outline" className="mt-6 w-full">
                      Write a review
                    </Button>
                  </Card>
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <Card key={review.id}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-soft text-[12px] font-semibold text-ink">
                              {review.initials}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-ink">{review.author}</p>
                              <p className="text-[12px] text-muted">{review.date}</p>
                            </div>
                          </div>
                          {review.verified ? (
                            <Badge tone="success">Verified buyer</Badge>
                          ) : null}
                        </div>
                        <Rating value={review.rating} showValue={false} className="mt-4" />
                        <h4 className="mt-3 text-[15px] font-semibold text-ink">
                          {review.title}
                        </h4>
                        <p className="mt-2 text-[14px] leading-relaxed text-muted">
                          {review.body}
                        </p>
                        <div className="mt-4 flex items-center gap-4 border-t border-line pt-4 text-[13px] text-muted">
                          <button type="button" className="hover:text-primary">
                            Helpful ({review.helpful})
                          </button>
                          <button type="button" className="hover:text-primary">
                            Report
                          </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              id: "delivery",
              label: "Delivery & returns",
              content: (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <h3 className="text-[15px] font-semibold text-ink">Delivery</h3>
                    <ul className="mt-4 space-y-3 text-[14px] text-muted">
                      <li>Express (next day) — free on orders over $99</li>
                      <li>Standard (2–4 days) — free on all orders</li>
                      <li>Store pickup — ready in 2 hours at 4 locations</li>
                      <li>Scheduled delivery — choose a 2-hour window</li>
                    </ul>
                  </Card>
                  <Card>
                    <h3 className="text-[15px] font-semibold text-ink">Returns</h3>
                    <ul className="mt-4 space-y-3 text-[14px] text-muted">
                      <li>30 days on unopened items</li>
                      <li>14 days on opened electronics</li>
                      <li>Prepaid return label included</li>
                      <li>Refunds issued within 3 working days of receipt</li>
                    </ul>
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </section>

      <section className="pt-16 sm:pt-20">
        <h2 className="mb-6 text-2xl font-semibold tracking-[-0.025em] text-ink">
          Related products
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {related.map((item) => (
            <TrackableProductCard
              key={item.id}
              product={item}
              rail="related"
              source="product-detail"
            />
          ))}
        </div>
      </section>

      <section className="pt-16 sm:pt-20">
        <h2 className="mb-6 text-2xl font-semibold tracking-[-0.025em] text-ink">
          You may also like
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {alsoLike.map((item) => (
            <TrackableProductCard
              key={item.id}
              product={item}
              rail="you-may-also-like"
              source="product-detail"
            />
          ))}
        </div>
      </section>

      <RecentlyViewedRail excludeId={product.id} />
    </div>
  );
}
