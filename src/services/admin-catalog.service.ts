import {
  addDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  brandDoc,
  brandsCollection,
  categoriesCollection,
  categoryDoc,
} from "@/firebase/collections";
import { slugify } from "@/utils/string";
import { writeAuditLog } from "@/services/audit.service";
import type { Brand, BrandDocument, Category, CategoryDocument } from "@/types/catalog";

type Actor = { id: string; email?: string };

export async function listCategoriesAdmin(): Promise<Category[]> {
  const snapshot = await getDocs(categoriesCollection());
  return snapshot.docs.map((d) => d.data());
}

export async function createCategoryAdmin(
  input: Omit<CategoryDocument, "createdAt" | "updatedAt">,
  actor: Actor,
) {
  const name = input.name.trim();
  const payload: CategoryDocument = {
    ...input,
    name,
    slug: (input.slug || slugify(name)).trim(),
    active: input.active !== false,
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };
  const ref = await addDoc(categoriesCollection(), payload);
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.create",
    resourceType: "category",
    resourceId: ref.id,
    newValue: { name, slug: payload.slug },
  });
  return ref.id;
}

export async function updateCategoryAdmin(
  id: string,
  patch: Partial<CategoryDocument>,
  actor: Actor,
) {
  await updateDoc(categoryDoc(id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.update",
    resourceType: "category",
    resourceId: id,
    newValue: patch,
  });
}

export async function deleteCategoryAdmin(id: string, actor: Actor) {
  await deleteDoc(categoryDoc(id));
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.delete",
    resourceType: "category",
    resourceId: id,
  });
}

export async function listBrandsAdmin(): Promise<Brand[]> {
  const snapshot = await getDocs(brandsCollection());
  return snapshot.docs.map((d) => d.data());
}

export async function createBrandAdmin(
  input: Omit<BrandDocument, "createdAt" | "updatedAt">,
  actor: Actor,
) {
  const name = input.name.trim();
  const payload: BrandDocument = {
    ...input,
    name,
    slug: (input.slug || slugify(name)).trim(),
    active: input.active !== false,
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };
  const ref = await addDoc(brandsCollection(), payload);
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "brand.create",
    resourceType: "brand",
    resourceId: ref.id,
    newValue: { name, slug: payload.slug },
  });
  return ref.id;
}

export async function updateBrandAdmin(
  id: string,
  patch: Partial<BrandDocument>,
  actor: Actor,
) {
  await updateDoc(brandDoc(id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "brand.update",
    resourceType: "brand",
    resourceId: id,
    newValue: patch,
  });
}

export async function deleteBrandAdmin(id: string, actor: Actor) {
  await deleteDoc(brandDoc(id));
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "brand.delete",
    resourceType: "brand",
    resourceId: id,
  });
}
