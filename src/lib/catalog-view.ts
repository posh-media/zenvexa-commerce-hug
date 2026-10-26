import type {
  Brand as BrandView,
  Category as CategoryView,
  IconKey,
} from "@/lib/data";
import type { Brand, Category } from "@/types/catalog";

const TONES = [
  "bg-[#F4F6FA]",
  "bg-[#F7F5FA]",
  "bg-[#F4F8F7]",
  "bg-[#FAF5F4]",
  "bg-[#F8F7F2]",
  "bg-[#F6F6F9]",
] as const;

const ICON_KEYWORDS: Array<[RegExp, IconKey]> = [
  [/laptop|computer|notebook/, "laptop"],
  [/phone|smartphone|mobile/, "smartphone"],
  [/tablet/, "tablet"],
  [/watch/, "watch"],
  [/furniture|home|kitchen|grocer/, "chair"],
  [/sport|vehicle|motorcycle/, "gamepad"],
  [/beauty|skin|fragrance/, "lightbulb"],
  [/accessories|sunglass|bag|shoe|shirt|dress|jewellery/, "plug"],
];

function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total + value.charCodeAt(index) * (index + 1)) % 997;
  }
  return total;
}

function iconFor(category: Category): IconKey {
  const haystack = `${category.name} ${category.slug}`.toLowerCase();
  return ICON_KEYWORDS.find(([pattern]) => pattern.test(haystack))?.[1] ?? "cpu";
}

export function toCategoryView(category: Category): CategoryView {
  return {
    name: category.name,
    slug: category.slug,
    icon: (category.icon as IconKey | undefined) ?? iconFor(category),
    itemCount: category.productCount ?? 0,
    tone: TONES[hash(category.slug) % TONES.length],
    subcategories: category.subcategories?.length
      ? category.subcategories
      : [category.name],
    description:
      category.description ??
      `Explore ${category.name.toLowerCase()} products on Zenvexa.`,
  };
}

export function toCategoryViews(categories: Category[]): CategoryView[] {
  return categories.map(toCategoryView);
}

export function toBrandView(brand: Brand): BrandView {
  const initials = brand.name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return {
    name: brand.name,
    slug: brand.slug,
    initials: initials || "SB",
    productCount: brand.productCount ?? 0,
    featured: Boolean(brand.featured),
    category: "Catalogue",
  };
}

export function toBrandViews(brands: Brand[]): BrandView[] {
  return brands.map(toBrandView);
}
