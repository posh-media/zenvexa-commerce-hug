import type {
  IconKey,
  Product as ProductView,
  Review as ReviewView,
} from "@/lib/data";
import type { Product } from "@/types/product";
import { formatDate } from "@/utils/date";
import { initials, truncate } from "@/utils/string";

/**
 * Adapter between the Firestore `Product` model and the view model the existing
 * UI components consume. The UI is unchanged, so anything Firestore does not
 * store yet (placeholder glyph, surface tone) is derived here.
 */

const TONES = [
  "bg-[#F4F6FA]",
  "bg-[#F7F5FA]",
  "bg-[#F4F8F7]",
  "bg-[#FAF5F4]",
  "bg-[#F8F7F2]",
  "bg-[#F6F6F9]",
] as const;

const ICON_KEYWORDS: Array<[RegExp, IconKey]> = [
  [/laptop|macbook|notebook|ultrabook|chromebook/, "laptop"],
  [/monitor|display|screen/, "monitor"],
  [/phone|smartphone|iphone|android|note/, "smartphone"],
  [/tablet|ipad/, "tablet"],
  [/headphone|earbud|airpod|headset/, "headphones"],
  [/speaker|soundbar|audio/, "speaker"],
  [/watch|band|tracker/, "watch"],
  [/console|gaming|playstation|xbox|gamepad/, "gamepad"],
  [/keyboard/, "keyboard"],
  [/mouse|trackpad/, "mouse"],
  [/camera|webcam|lens/, "camera"],
  [/printer|scanner/, "printer"],
  [/router|mesh|network/, "router"],
  [/cpu|processor|gpu|graphics/, "cpu"],
  [/ssd|hdd|storage|drive/, "harddrive"],
  [/bulb|light|lamp|smart home/, "lightbulb"],
  [/chair|desk|office|furniture/, "chair"],
  [/plug|socket|charger|power/, "plug"],
];

function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total + value.charCodeAt(index) * (index + 1)) % 997;
  }
  return total;
}

function iconFor(product: Product): IconKey {
  const haystack = `${product.name} ${product.category ?? ""}`.toLowerCase();
  return ICON_KEYWORDS.find(([pattern]) => pattern.test(haystack))?.[1] ?? "cpu";
}

function brandFor(product: Product) {
  if (product.brand?.trim()) return product.brand.trim();
  if (product.brandId && product.brandId !== "unbranded") {
    return product.brandId
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return product.name.split(/\s+/)[0] ?? "Zenvexa";
}

function badgeFor(product: Product) {
  if (product.officialStore) return "Official store";
  if (product.sponsored) return "Sponsored";
  return undefined;
}

function shortDescriptionFor(product: Product) {
  const firstSentence = product.description.split(/(?<=\.)\s/)[0] ?? "";
  return truncate(firstSentence || product.description, 140);
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function toProductView(product: Product): ProductView {
  const category = titleCase(product.category ?? "Uncategorised");
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: brandFor(product),
    category,
    subcategory: category,
    price: product.price,
    oldPrice: product.oldPrice,
    rating: product.rating,
    reviews: product.reviewCount,
    stock: product.stock ?? 0,
    icon: iconFor(product),
    tone: TONES[hash(product.id) % TONES.length],
    badge: badgeFor(product),
    tags: product.tags,
    shortDescription: shortDescriptionFor(product),
    description: product.description,
    highlights: product.specifications
      .slice(0, 4)
      .map((spec) => `${spec.label}: ${spec.value}`),
    specs: product.specifications,
    colors:
      product.variations.length > 0
        ? product.variations
        : product.variants.map((variant) => variant.value),
    images: product.images,
    thumbnail: product.thumbnail,
    categoryId: product.categoryId,
    brandId: product.brandId,
    sku: product.sku,
    sponsored: product.sponsored,
    officialStore: product.officialStore,
    createdAt: product.createdAt?.getTime(),
  };
}

export function toProductViews(products: Product[]): ProductView[] {
  return products.map(toProductView);
}

/** Embedded Firestore reviews mapped onto the review card view model. */
export function toReviewViews(product: Product): ReviewView[] {
  return product.reviews.map((review, index) => ({
    id: `${product.id}-review-${index}`,
    author: review.reviewBy,
    initials: initials(review.reviewBy),
    rating: review.rating,
    date: review.date ? formatDate(review.date) : "",
    title: review.nice ?? truncate(review.comment, 60),
    body: review.comment,
    verified: true,
    helpful: 0,
  }));
}

export function ratingBreakdown(reviews: ReviewView[]) {
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((review) => Math.round(review.rating) === stars).length,
  }));
}
