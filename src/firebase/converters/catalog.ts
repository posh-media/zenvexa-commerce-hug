import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  WithFieldValue,
} from "firebase/firestore";
import type { Brand, BrandDocument, Category, CategoryDocument } from "@/types/catalog";
import { stripUndefined } from "@/utils/firestore";
import { slugify } from "@/utils/string";

/** Normalize a raw category document. */
export function toCategory(id: string, raw: Partial<CategoryDocument>): Category {
  const name = raw.name ?? id;
  const description =
    raw.description ?? `Browse ${name} products on Zenvexa.`;
  return {
    id,
    name,
    slug: raw.slug ?? (slugify(name) || id),
    description,
    image: raw.image,
    icon: raw.icon,
    parentId: raw.parentId ?? null,
    subcategories: raw.subcategories ?? [],
    productCount: raw.productCount ?? 0,
    featured: raw.featured ?? false,
    active: raw.active ?? true,
    seoTitle: raw.seoTitle ?? name,
    seoDescription: raw.seoDescription ?? description,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/** Normalize a raw brand document. */
export function toBrand(id: string, raw: Partial<BrandDocument>): Brand {
  const name = raw.name ?? id;
  const description = raw.description ?? `${name} products on Zenvexa.`;
  const logo = raw.logo ?? raw.logoUrl ?? "";
  return {
    id,
    name,
    slug: raw.slug ?? (slugify(name) || id),
    logo,
    logoUrl: raw.logoUrl ?? logo,
    description,
    categoryId: raw.categoryId,
    productCount: raw.productCount ?? 0,
    featured: raw.featured ?? false,
    active: raw.active ?? true,
    seoTitle: raw.seoTitle ?? name,
    seoDescription: raw.seoDescription ?? description,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export const categoryConverter: FirestoreDataConverter<Category, CategoryDocument> =
  {
    toFirestore(category: WithFieldValue<Category>) {
      const data = { ...(category as Category) } as Record<string, unknown>;
      delete data.id;
      return stripUndefined(data) as CategoryDocument;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot<CategoryDocument>) {
      return toCategory(snapshot.id, snapshot.data());
    },
  };

export const brandConverter: FirestoreDataConverter<Brand, BrandDocument> = {
  toFirestore(brand: WithFieldValue<Brand>) {
    const data = { ...(brand as Brand) } as Record<string, unknown>;
    delete data.id;
    return stripUndefined(data) as BrandDocument;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot<BrandDocument>) {
    return toBrand(snapshot.id, snapshot.data());
  },
};
