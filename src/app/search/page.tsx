import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { toBrandViews, toCategoryViews } from "@/lib/catalog-view";
import { searchCrumbs } from "@/lib/breadcrumbs";
import { toProductViews } from "@/lib/product-view";
import { buildListingMetadata, breadcrumbJsonLd, JsonLd } from "@/lib/seo";
import { searchProducts } from "@/services/products.service";
import {
  getBrands,
  getCategories,
  getPopularSearchTerms,
} from "@/services/catalog.service";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NoResultsIllustration } from "@/components/ui/illustrations";
import { SearchBar } from "@/components/commerce/search-bar";
import { RecentSearchesCard } from "@/components/commerce/recent-searches";
import { ProductBrowser } from "@/components/commerce/product-browser";
import { CatalogError } from "@/components/commerce/catalog-state";
import { TrackSearchPerformed } from "@/components/commerce/catalog-analytics-beacons";

export function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string };
}): Metadata {
  const queryTerm = searchParams.q?.trim();
  return buildListingMetadata({
    title: queryTerm ? `Search: ${queryTerm}` : "Search",
    description: queryTerm
      ? `Search results for “${queryTerm}” on Zenvexa.`
      : "Search the Zenvexa catalogue.",
    path: queryTerm ? `/search?q=${encodeURIComponent(queryTerm)}` : "/search",
  });
}

/** Results depend on `?q=`, so this page is rendered per request. */
export const dynamic = "force-dynamic";

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const queryTerm = searchParams.q?.trim() ?? "";
  let results: ReturnType<typeof toProductViews> = [];
  let categories: ReturnType<typeof toCategoryViews> = [];
  let brands: ReturnType<typeof toBrandViews> = [];
  let popular: string[] = [];
  let failed = false;
  try {
    const [products, categoryDocs, brandDocs, popularTerms] = await Promise.all([
      searchProducts(queryTerm),
      getCategories(),
      getBrands(),
      getPopularSearchTerms(),
    ]);
    results = toProductViews(products);
    categories = toCategoryViews(categoryDocs);
    brands = toBrandViews(brandDocs);
    popular = popularTerms;
  } catch {
    failed = true;
  }

  const crumbs = searchCrumbs(queryTerm || undefined);

  return (
    <div className="sb-container">
      <JsonLd
        data={breadcrumbJsonLd(
          crumbs
            .filter((crumb) => crumb.href)
            .map((crumb) => ({ name: crumb.label, path: crumb.href })),
        )}
      />
      <TrackSearchPerformed query={queryTerm} resultCount={results.length} />
      <PageHeader
        crumbs={crumbs}
        title="Search results"
        description={
          queryTerm
            ? `${results.length.toLocaleString()} results for “${queryTerm}”. Refine with filters or try a related search.`
            : "Showing the full catalogue. Refine with filters or try a related search."
        }
      />

      <div className="mb-8 max-w-3xl">
        <SearchBar
          size="lg"
          withSuggestions
          initialQuery={queryTerm}
          suggestions={popular}
        />
      </div>

      <div className="mb-10 grid gap-4 lg:grid-cols-2">
        <RecentSearchesCard />

        <Card>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
            Popular searches
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {popular.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-line px-3.5 py-2 text-[13px] text-ink-soft transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary"
              >
                {term}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {failed ? (
        <CatalogError compact={false} />
      ) : queryTerm && !results.length ? (
        <EmptyState
          illustration={<NoResultsIllustration />}
          title={`No matches for “${queryTerm}”`}
          description="Check the spelling, use fewer words, or browse the closest category instead."
          actions={
            <>
              <ButtonLink href="/products">Browse all products</ButtonLink>
              <ButtonLink href="/help" variant="outline">
                Ask support
              </ButtonLink>
            </>
          }
        />
      ) : (
        <Suspense fallback={null}>
          <ProductBrowser
            items={results}
            categories={categories}
            brands={brands}
            showSidebarFilters
            preserveQuery
          />
        </Suspense>
      )}
    </div>
  );
}
