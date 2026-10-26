import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toBrandViews, toCategoryView, toCategoryViews } from "@/lib/catalog-view";
import { toProductViews } from "@/lib/product-view";
import {
  breadcrumbJsonLd,
  buildCategoryMetadata,
  categoryItemListJsonLd,
  JsonLd,
} from "@/lib/seo";
import { getProductsByCategory } from "@/services/products.service";
import {
  getBrands,
  getCategories,
  getCategoryBySlug,
} from "@/services/catalog.service";
import { TrackCategoryViewed } from "@/components/commerce/catalog-analytics-beacons";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/card";
import { ProductIcon } from "@/components/commerce/product-media";
import { ProductCard } from "@/components/commerce/product-card";
import { ProductBrowser } from "@/components/commerce/product-browser";
import { CatalogEmpty, CatalogError } from "@/components/commerce/catalog-state";

export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const categories = await getCategories();
    return categories.map((category) => ({ slug: category.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const category = await getCategoryBySlug(params.slug);
  if (!category) return { title: "Category" };
  return buildCategoryMetadata(category);
}

export default async function CategoryPage({
  params,
}: {
  params: { slug: string };
}) {
  const categoryDoc = await getCategoryBySlug(params.slug);
  if (!categoryDoc) notFound();
  const category = toCategoryView(categoryDoc);

  let listing: ReturnType<typeof toProductViews> = [];
  let brands: ReturnType<typeof toBrandViews> = [];
  let categories: ReturnType<typeof toCategoryViews> = [];
  let failed = false;
  try {
    const [matches, brandDocs, categoryDocs] = await Promise.all([
      getProductsByCategory(params.slug),
      getBrands(),
      getCategories(),
    ]);
    listing = toProductViews(matches);
    brands = toBrandViews(brandDocs);
    categories = toCategoryViews(categoryDocs);
  } catch {
    failed = true;
  }
  const featured = listing.filter((item) => item.tags.includes("featured")).slice(0, 4);
  const featuredRail = featured.length ? featured : listing.slice(0, 4);

  return (
    <div className="sb-container">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/products" },
          { name: category.name, path: `/category/${category.slug}` },
        ])}
      />
      <JsonLd
        data={categoryItemListJsonLd(
          categoryDoc,
          listing.map((item) => ({ name: item.name, slug: item.slug })),
        )}
      />
      <TrackCategoryViewed categoryId={categoryDoc.id} slug={category.slug} />

      <div className="pt-6 sm:pt-8">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Categories", href: "/products" },
            { label: category.name },
          ]}
        />
      </div>

      <section
        className={cn(
          "relative mt-5 overflow-hidden rounded-3xl border border-line p-7 sm:p-10",
          category.tone,
        )}
      >
        <span
          className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/70 blur-3xl"
          aria-hidden
        />
        <div className="relative max-w-xl">
          <Badge tone="primary" className="mb-4">
            {(categoryDoc.productCount ?? listing.length).toLocaleString()} products
          </Badge>
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-display-sm">
            {category.name}
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted sm:text-base">
            {category.description}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/products">
              Shop {category.name.toLowerCase()}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/deals" variant="outline">
              Deals in this category
            </ButtonLink>
          </div>
        </div>
        <ProductIcon
          icon={category.icon}
          className="pointer-events-none absolute -bottom-8 right-8 hidden h-56 w-56 text-ink/10 lg:block"
        />
      </section>

      <section className="pt-12">
        <h2 className="mb-4 text-[15px] font-semibold text-ink">Browse categories</h2>
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {categories.slice(0, 10).map((item) => (
            <Link
              key={item.slug}
              href={`/category/${item.slug}`}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-colors",
                item.slug === category.slug
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-white text-ink-soft hover:border-ink/20 hover:bg-soft",
              )}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="pt-14">
        <SectionHeading
          eyebrow="Buyers' picks"
          title={`Featured in ${category.name}`}
          action={
            <ButtonLink href="/products" variant="outline" size="sm">
              View all
            </ButtonLink>
          }
        />
        {failed ? <CatalogError /> : null}
        {!failed && !featuredRail.length ? <CatalogEmpty /> : null}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {featuredRail.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="pt-16">
        <SectionHeading title={`All ${category.name.toLowerCase()}`} />
        {failed ? (
          <CatalogError compact={false} />
        ) : listing.length ? (
          <Suspense fallback={null}>
            <ProductBrowser
              items={listing}
              categories={categories}
              brands={brands}
              showSidebarFilters
            />
          </Suspense>
        ) : (
          <CatalogEmpty
            compact={false}
            description={`No products are listed under ${category.name} yet.`}
          />
        )}
      </section>
    </div>
  );
}
