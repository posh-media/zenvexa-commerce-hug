import {
  addDoc,
  collection,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { stockStatusFromCount } from "@/constants/app";
import { COLLECTIONS } from "@/constants/collections";
import { getDb } from "@/firebase/firestore";
import {
  productDoc,
  productsCollection,
} from "@/firebase/collections";
import { slugify } from "@/utils/string";
import { writeAuditLog } from "@/services/audit.service";
import type { Product, ProductDocument } from "@/types/product";

export type AdminProductInput = Partial<ProductDocument> & {
  productName: string;
};

function productsCol() {
  return productsCollection();
}

function rawProductsCol() {
  return collection(getDb(), COLLECTIONS.products);
}

export async function listAllProductsAdmin(): Promise<Product[]> {
  const snapshot = await getDocs(productsCol());
  return snapshot.docs.map((document) => document.data());
}

export async function getProductAdmin(id: string) {
  const snapshot = await getDoc(productDoc(id));
  return snapshot.exists() ? snapshot.data() : undefined;
}

export async function createProductAdmin(
  input: AdminProductInput,
  actor: { id: string; email?: string },
) {
  const name = input.productName.trim();
  const slug = (input.slug || slugify(name)).trim();
  const stock = Number(input.stock ?? 0);
  const payload: ProductDocument = {
    ...input,
    productName: name,
    slug,
    stock,
    stockStatus: stockStatusFromCount(stock),
    active: input.active !== false,
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };
  const ref = await addDoc(rawProductsCol(), payload);
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.create",
    resourceType: "product",
    resourceId: ref.id,
    newValue: { productName: name, slug },
  });
  return ref.id;
}

export async function updateProductAdmin(
  id: string,
  patch: Partial<ProductDocument>,
  actor: { id: string; email?: string },
  previous?: Partial<ProductDocument>,
) {
  const next = { ...patch, updatedAt: serverTimestamp() as never };
  if (patch.stock != null) {
    next.stockStatus = stockStatusFromCount(Number(patch.stock));
  }
  await updateDoc(productDoc(id), next);
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.update",
    resourceType: "product",
    resourceId: id,
    previousValue: previous ?? null,
    newValue: patch,
  });
}

export async function archiveProductAdmin(
  id: string,
  actor: { id: string; email?: string },
) {
  await updateProductAdmin(id, { active: false }, actor, { active: true });
}

export async function deleteProductAdmin(
  id: string,
  actor: { id: string; email?: string },
) {
  await deleteDoc(productDoc(id));
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "product.delete",
    resourceType: "product",
    resourceId: id,
  });
}

export async function duplicateProductAdmin(
  id: string,
  actor: { id: string; email?: string },
) {
  const existing = await getProductAdmin(id);
  if (!existing) throw new Error("Product not found.");
  const name = `${existing.productName} (Copy)`;
  return createProductAdmin(
    {
      productName: name,
      slug: `${existing.slug}-copy-${Date.now().toString(36)}`,
      description: existing.description,
      price: existing.price,
      discount: existing.discount,
      currency: existing.currency,
      category: existing.category,
      categoryId: existing.categoryId,
      brand: existing.brand,
      brandId: existing.brandId,
      stock: existing.stock,
      images: existing.images,
      thumbnail: existing.thumbnail,
      sku: existing.sku ? `${existing.sku}-COPY` : undefined,
      featured: false,
      trending: false,
      flashSale: false,
      bestSeller: false,
      sponsored: false,
      officialStore: existing.officialStore,
      active: false,
      seoTitle: existing.seoTitle,
      seoDescription: existing.seoDescription,
      tags: existing.tags,
      specifications: existing.specifications,
      variants: existing.variants,
      variation: existing.variations,
    },
    actor,
  );
}

export async function bulkSetProductActive(
  ids: string[],
  active: boolean,
  actor: { id: string; email?: string },
) {
  await Promise.all(
    ids.map((id) => updateProductAdmin(id, { active }, actor)),
  );
}
