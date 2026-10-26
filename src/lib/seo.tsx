import type { Metadata } from "next";
import type { Product } from "@/types/product";
import type { Brand, Category } from "@/types/catalog";
import { APP_NAME, CURRENCY } from "@/constants/app";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://zenvexacommerce.com";

const DEFAULT_KEYWORDS = [
  "Zenvexa",
  "electronics",
  "gadgets",
  "laptops",
  "phones",
  "gaming",
  "smart home",
  "Nigeria",
];

export function absoluteUrl(path = "/") {
  if (path.startsWith("http")) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getSiteUrl() {
  return SITE_URL;
}

export function productCanonicalPath(product: Product) {
  return `/product/${product.slug || product.id}`;
}

export function categoryCanonicalPath(category: Category) {
  return `/category/${category.slug}`;
}

/** Private / transactional pages — never index. */
export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export function buildPrivateMetadata(title: string, description?: string): Metadata {
  return {
    title,
    description: description ?? `${title} on ${APP_NAME}.`,
    ...noIndexMetadata,
  };
}

function withSocial(
  base: Metadata,
  input: {
    title: string;
    description: string;
    url: string;
    image?: string;
    imageAlt?: string;
    keywords?: string[];
  },
): Metadata {
  return {
    ...base,
    keywords: input.keywords ?? DEFAULT_KEYWORDS,
    openGraph: {
      type: "website",
      url: input.url,
      title: `${input.title} · ${APP_NAME}`,
      description: input.description,
      siteName: APP_NAME,
      locale: "en_NG",
      images: input.image
        ? [{ url: input.image, alt: input.imageAlt ?? input.title }]
        : undefined,
    },
    twitter: {
      card: input.image ? "summary_large_image" : "summary",
      title: `${input.title} · ${APP_NAME}`,
      description: input.description,
      images: input.image ? [input.image] : undefined,
    },
  };
}

export function buildProductMetadata(product: Product): Metadata {
  const title = product.name;
  const description =
    product.description?.slice(0, 160) ||
    `${product.name} available on ${APP_NAME}.`;
  const image = product.thumbnail ?? product.images[0];
  const url = absoluteUrl(productCanonicalPath(product));
  const keywords = [
    product.name,
    product.brand,
    product.category,
    product.sku,
    ...DEFAULT_KEYWORDS,
  ].filter(Boolean) as string[];

  return withSocial(
    {
      title,
      description,
      alternates: { canonical: url },
    },
    {
      title,
      description,
      url,
      image,
      imageAlt: `${product.name}${product.brand ? ` by ${product.brand}` : ""} — ${CURRENCY.symbol}${product.price.toLocaleString()}`,
      keywords,
    },
  );
}

export function buildCategoryMetadata(category: Category): Metadata {
  const title = category.name;
  const description =
    category.seoDescription?.slice(0, 160) ||
    category.description?.slice(0, 160) ||
    `Shop ${category.name} on ${APP_NAME}.`;
  const url = absoluteUrl(categoryCanonicalPath(category));
  const image = category.image;

  return withSocial(
    {
      title: category.seoTitle || title,
      description,
      alternates: { canonical: url },
    },
    {
      title: category.seoTitle || title,
      description,
      url,
      image,
      keywords: [category.name, ...DEFAULT_KEYWORDS],
    },
  );
}

export function buildBrandMetadata(brand: Brand): Metadata {
  const title = brand.name;
  const description =
    brand.seoDescription?.slice(0, 160) ||
    brand.description?.slice(0, 160) ||
    `Shop ${brand.name} on ${APP_NAME}.`;
  const url = absoluteUrl(`/products?brand=${brand.slug}`);
  const image = brand.logo || brand.logoUrl;

  return withSocial(
    {
      title: brand.seoTitle || title,
      description,
      alternates: { canonical: url },
    },
    {
      title: brand.seoTitle || title,
      description,
      url,
      image,
      keywords: [brand.name, ...DEFAULT_KEYWORDS],
    },
  );
}

export function buildListingMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(input.path);
  const base = withSocial(
    {
      title: input.title,
      description: input.description,
      alternates: { canonical: url },
    },
    {
      title: input.title,
      description: input.description,
      url,
      image: input.image,
      keywords: input.keywords,
    },
  );
  if (input.noIndex) {
    return { ...base, ...noIndexMetadata };
  }
  return base;
}

export function productJsonLd(product: Product) {
  const image = product.images.length
    ? product.images
    : product.thumbnail
      ? [product.thumbnail]
      : undefined;

  const reviews =
    product.reviews?.slice(0, 5).map((review) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: review.reviewBy || "Zenvexa customer",
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
      },
      reviewBody: review.comment || review.nice,
      datePublished:
        review.date instanceof Date
          ? review.date.toISOString()
          : undefined,
    })) ?? [];

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku ?? product.id,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : undefined,
    image,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(productCanonicalPath(product)),
      priceCurrency: CURRENCY.code,
      price: product.price,
      availability:
        (product.stock ?? 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: APP_NAME,
      },
    },
    aggregateRating:
      product.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          }
        : undefined,
    review: reviews.length ? reviews : undefined,
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path?: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path ? absoluteUrl(item.path) : undefined,
    })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon.png"),
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["English"],
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function categoryItemListJsonLd(
  category: Category,
  products: Array<{ name: string; slug: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description: category.description,
    url: absoluteUrl(categoryCanonicalPath(category)),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.slice(0, 24).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/product/${product.slug}`),
        name: product.name,
      })),
    },
  };
}

export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
