import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { getActiveProducts } from "@/services/products.service";
import { getBrands, getCategories } from "@/services/catalog.service";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/products"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/brands"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/deals"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/help"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/search"), changeFrequency: "weekly", priority: 0.5 },
  ];

  let products: MetadataRoute.Sitemap = [];
  let categories: MetadataRoute.Sitemap = [];
  let brands: MetadataRoute.Sitemap = [];

  try {
    const [productDocs, categoryDocs, brandDocs] = await Promise.all([
      getActiveProducts(),
      getCategories(),
      getBrands(),
    ]);

    products = productDocs.map((product) => ({
      url: absoluteUrl(`/product/${product.slug || product.id}`),
      lastModified:
        product.updatedAt instanceof Date
          ? product.updatedAt
          : product.createdAt instanceof Date
            ? product.createdAt
            : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    categories = categoryDocs.map((category) => ({
      url: absoluteUrl(`/category/${category.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    brands = brandDocs.map((brand) => ({
      url: absoluteUrl(`/products?brand=${brand.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // Return static routes if Firestore is unavailable at build/request time.
  }

  return [...staticRoutes, ...categories, ...brands, ...products];
}
