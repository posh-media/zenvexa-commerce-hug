import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toBrandViews, toCategoryViews } from "@/lib/catalog-view";
import { toProductViews } from "@/lib/product-view";
import { buildListingMetadata } from "@/lib/seo";
import { getFeaturedProducts } from "@/services/products.service";
import { getBrands, getCategories } from "@/services/catalog.service";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { BrandMark, ProductIcon } from "@/components/commerce/product-media";
import { ProductCard } from "@/components/commerce/product-card";
import { CatalogEmpty, CatalogError } from "@/components/commerce/catalog-state";

export const metadata: Metadata = buildListingMetadata({
  title: "Brands",
  description: "Browse brands in the live Zenvexa catalogue.",
  path: "/brands",
});

export const revalidate = 60;

const letters = ["All", "A–F", "G–L", "M–R", "S–Z"];

export default async function BrandsPage() {
  let brands: ReturnType<typeof toBrandViews> = [];
  let categories: ReturnType<typeof toCategoryViews> = [];
  let spotlight: ReturnType<typeof toProductViews> = [];
  let failed = false;
  try {
    const [brandDocs, categoryDocs, featured] = await Promise.all([
      getBrands(),
      getCategories(),
      getFeaturedProducts(4),
    ]);
    brands = toBrandViews(brandDocs);
    categories = toCategoryViews(categoryDocs);
    spotlight = toProductViews(featured);
  } catch {
    failed = true;
  }

  const featured = brands.filter((brand) => brand.featured);
  const collections = categories.slice(0, 3);

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Brands" }]}
        title="Brands"
        description={`${brands.length.toLocaleString()} brands sourced from the live Zenvexa catalogue.`}
      />

      <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:max-w-sm sm:flex-1">
          <Input
            placeholder="Search brands"
            aria-label="Search brands"
            icon={<Search className="h-[18px] w-[18px]" />}
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {letters.map((letter, index) => (
            <button
              key={letter}
              type="button"
              className={cn(
                "shrink-0 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-colors",
                index === 0
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink-soft hover:bg-soft",
              )}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {failed ? <CatalogError compact={false} /> : null}

      <section>
        <SectionHeading
          eyebrow="Partners"
          title="Featured brands"
          description="Brands with the widest range on Zenvexa."
        />
        {!failed && !featured.length ? <CatalogEmpty /> : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((brand) => (
            <Link
              key={brand.slug}
              href={`/products?brand=${brand.slug}`}
              className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-5 transition-all duration-300 ease-premium hover:-translate-y-1 hover:border-transparent hover:sb-shadow-hover"
            >
              <BrandMark
                initials={brand.initials}
                className="h-14 w-14 text-base transition-colors group-hover:bg-primary-50 group-hover:text-primary"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                  {brand.name}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  {brand.productCount.toLocaleString()} products
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      <section className="pt-16">
        <SectionHeading title="All brands" description="A–Z, updated from Firestore." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <Link
              key={brand.slug}
              href={`/products?brand=${brand.slug}`}
              className="flex items-center justify-between rounded-2xl border border-line bg-white px-5 py-4 transition-colors hover:bg-soft"
            >
              <span className="flex items-center gap-3">
                <BrandMark initials={brand.initials} className="h-10 w-10 text-xs" />
                <span>
                  <span className="block text-sm font-medium text-ink">{brand.name}</span>
                  <span className="block text-[12px] text-muted">
                    {brand.productCount.toLocaleString()} products
                  </span>
                </span>
              </span>
              {brand.featured ? <Badge tone="primary">Featured</Badge> : null}
            </Link>
          ))}
        </div>
      </section>

      <section className="pt-16">
        <SectionHeading title="Shop by category" />
        <div className="grid gap-4 sm:grid-cols-3">
          {collections.map((category) => (
            <Card key={category.slug} className="relative overflow-hidden">
              <span className={cn("absolute inset-0 opacity-70", category.tone)} aria-hidden />
              <div className="relative">
                <ProductIcon icon={category.icon} className="h-8 w-8 text-ink/70" />
                <h3 className="mt-4 text-[17px] font-semibold text-ink">{category.name}</h3>
                <p className="mt-2 text-[13px] text-muted">{category.description}</p>
                <ButtonLink href={`/category/${category.slug}`} className="mt-5" size="sm">
                  Browse
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="pt-16">
        <SectionHeading title="Best of the big brands" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {spotlight.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
