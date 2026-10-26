import type { Metadata } from "next";
import { Suspense } from "react";
import { toBrandViews, toCategoryViews } from "@/lib/catalog-view";
import { toProductViews } from "@/lib/product-view";
import { buildListingMetadata } from "@/lib/seo";
import { getActiveProducts } from "@/services/products.service";
import { getBrands, getCategories } from "@/services/catalog.service";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBar } from "@/components/commerce/search-bar";
import { ProductBrowser } from "@/components/commerce/product-browser";
import { CatalogEmpty, CatalogError } from "@/components/commerce/catalog-state";

export const metadata: Metadata = buildListingMetadata({
  title: "All products",
  description: "Browse every product in the Zenvexa catalogue.",
  path: "/products",
});

export const revalidate = 60;

export default async function ProductListingPage() {
  let items: ReturnType<typeof toProductViews> = [];
  let categories: ReturnType<typeof toCategoryViews> = [];
  let brands: ReturnType<typeof toBrandViews> = [];
  let failed = false;
  try {
    const [products, categoryDocs, brandDocs] = await Promise.all([
      getActiveProducts(),
      getCategories(),
      getBrands(),
    ]);
    items = toProductViews(products);
    categories = toCategoryViews(categoryDocs);
    brands = toBrandViews(brandDocs);
  } catch {
    failed = true;
  }

  return (
    <div className="sb-container">
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "All products" }]}
        title="All products"
        description={`${items.length.toLocaleString()} products across the live Zenvexa catalogue.`}
      />

      <div className="mb-8 max-w-2xl">
        <SearchBar size="lg" withSuggestions={false} />
      </div>

      {failed ? (
        <CatalogError compact={false} />
      ) : items.length ? (
        <Suspense fallback={<CatalogEmpty compact={false} title="Loading catalogue…" />}>
          <ProductBrowser
            items={items}
            categories={categories}
            brands={brands}
            showSidebarFilters
          />
        </Suspense>
      ) : (
        <CatalogEmpty
          compact={false}
          title="No products yet"
          description="The catalogue is empty. Products added in Firestore appear here automatically."
        />
      )}
    </div>
  );
}
