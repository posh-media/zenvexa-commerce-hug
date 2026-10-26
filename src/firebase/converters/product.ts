import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  WithFieldValue,
} from "firebase/firestore";
import type { ProductTag } from "@/constants/app";
import { CURRENCY, stockStatusFromCount } from "@/constants/app";
import { productDocumentSchema } from "@/schemas/product.schema";
import type { Product, ProductDocument } from "@/types/product";
import { priceBeforeDiscount } from "@/utils/currency";
import {
  parseSpecificationBlock,
  stripUndefined,
  toDate,
} from "@/utils/firestore";
import { slugify } from "@/utils/string";

function deriveTags(document: ProductDocument): ProductTag[] {
  if (document.tags?.length) return document.tags;
  const tags: ProductTag[] = [];
  if (document.flashSale) tags.push("flash-sale");
  if (document.featured) tags.push("featured");
  if (document.trending) tags.push("trending");
  if (document.bestSeller) tags.push("best-seller");
  if (document.discount) tags.push("special-offer");
  return tags;
}

function keywordList(document: ProductDocument): string[] {
  if (document.searchKeywords?.length) return document.searchKeywords;
  if (document.keywords?.length) return document.keywords;
  return [
    document.productName,
    document.brand,
    document.category,
    document.sku,
  ].filter((value): value is string => Boolean(value && value.trim()));
}

/** Normalize a raw `products` document into the app-level `Product` model. */
export function toProduct(id: string, raw: unknown): Product {
  const parsed = productDocumentSchema.safeParse(raw);
  const document = (parsed.success ? parsed.data : {}) as ProductDocument;
  const name = document.productName ?? id;
  const price = document.price ?? 0;
  const images = document.images ?? document.imgs ?? [];
  const reviews = document.reviews ?? [];
  const stock = document.stock ?? 0;
  const searchKeywords = keywordList(document);

  return {
    id,
    name,
    productName: name,
    slug: document.slug ?? slugify(name),
    description: document.description ?? "",
    price,
    discount: document.discount ?? 0,
    currency: document.currency ?? CURRENCY.code,
    oldPrice: priceBeforeDiscount(price, document.discount),
    rating: document.rating ?? 0,
    reviewCount: document.reviewCount ?? reviews.length,
    images,
    thumbnail: document.thumbnail ?? images[0],
    category: document.category,
    categoryId: document.categoryId,
    brand: document.brand,
    brandId: document.brandId,
    stock,
    stockStatus: document.stockStatus ?? stockStatusFromCount(stock),
    sku: document.sku,
    barcode: document.barcode,
    variations:
      document.variation ??
      document.variants?.map((variant) => variant.value) ??
      [],
    variants:
      document.variants ??
      (document.variation ?? []).map((value) => ({ label: "Variant", value })),
    specifications:
      document.specifications ?? parseSpecificationBlock(document.specification),
    specification: document.specification,
    reviews,
    sponsored: document.sponsored ?? false,
    officialStore: document.officialStore ?? document.officalStore ?? false,
    tags: deriveTags(document),
    featured: document.featured ?? false,
    trending: document.trending ?? false,
    flashSale: document.flashSale ?? false,
    bestSeller: document.bestSeller ?? false,
    active: document.active ?? true,
    seoTitle: document.seoTitle ?? name,
    seoDescription:
      document.seoDescription ??
      (document.description ? document.description.slice(0, 160) : undefined),
    seoKeywords: document.seoKeywords ?? searchKeywords,
    searchKeywords,
    viewCount: document.viewCount ?? 0,
    salesCount: document.salesCount ?? 0,
    wishlistCount: document.wishlistCount ?? 0,
    createdAt: toDate(document.createdAt),
    updatedAt: toDate(document.updatedAt),
  };
}

/** Map an app-level `Product` back onto Firestore field names. */
export function toProductDocument(
  product: Partial<Product>,
): Partial<ProductDocument> {
  return stripUndefined({
    productName: product.productName ?? product.name,
    description: product.description,
    specification: product.specification,
    price: product.price,
    discount: product.discount,
    currency: product.currency,
    rating: product.rating,
    imgs: product.images,
    variation: product.variations,
    variants: product.variants,
    barcode: product.barcode,
    category: product.category,
    sponsored: product.sponsored,
    officialStore: product.officialStore,
    reviews: product.reviews,
    slug: product.slug,
    sku: product.sku,
    brand: product.brand,
    brandId: product.brandId,
    categoryId: product.categoryId,
    thumbnail: product.thumbnail,
    images: product.images,
    stock: product.stock,
    stockStatus: product.stockStatus,
    reviewCount: product.reviewCount,
    specifications: product.specifications,
    tags: product.tags,
    featured: product.featured,
    trending: product.trending,
    flashSale: product.flashSale,
    bestSeller: product.bestSeller,
    active: product.active,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    seoKeywords: product.seoKeywords,
    searchKeywords: product.searchKeywords,
    viewCount: product.viewCount,
    salesCount: product.salesCount,
    wishlistCount: product.wishlistCount,
  });
}

export const productConverter: FirestoreDataConverter<Product, ProductDocument> =
  {
    toFirestore(product: WithFieldValue<Product>) {
      return toProductDocument(product as Partial<Product>) as ProductDocument;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot<ProductDocument>) {
      return toProduct(snapshot.id, snapshot.data());
    },
  };
