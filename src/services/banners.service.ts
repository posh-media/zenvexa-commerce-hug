import { COLLECTIONS } from "@/constants/collections";
import { getDb } from "@/firebase/firestore";
import { belongsToStore, deploymentStoreId } from "@/lib/store";
import { storeDocuments } from "@/lib/store-queries";
import { writeAuditLog } from "@/services/audit.service";
import type { Banner, BannerDocument } from "@/types/admin";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type Actor = { id: string; email?: string };

function bannersCollection() {
  return collection(getDb(), COLLECTIONS.banners);
}

function bannerDoc(id: string) {
  return doc(getDb(), COLLECTIONS.banners, id);
}

export async function listBannersAdmin(): Promise<Banner[]> {
  const documents = await storeDocuments(bannersCollection());
  return documents
    .map((d) => ({ id: d.id, ...(d.data() as BannerDocument) }))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

export async function createBannerAdmin(
  input: Omit<BannerDocument, "createdAt" | "updatedAt">,
  actor: Actor,
) {
  const payload: BannerDocument = {
    ...input,
    storeId: deploymentStoreId(),
    active: input.active !== false,
    displayOrder: input.displayOrder ?? 0,
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };
  const ref = await addDoc(bannersCollection(), payload);
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "banner.create",
    resourceType: "banner",
    resourceId: ref.id,
    newValue: { title: input.title },
  });
  return ref.id;
}

export async function updateBannerAdmin(
  id: string,
  patch: Partial<BannerDocument>,
  actor: Actor,
) {
  const existing = await getDoc(bannerDoc(id));
  if (!existing.exists() || !belongsToStore(existing.data()))
    throw new Error("Record not found.");
  await updateDoc(bannerDoc(id), {
    ...patch,
    storeId: deploymentStoreId(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "banner.update",
    resourceType: "banner",
    resourceId: id,
    newValue: patch,
  });
}

export async function deleteBannerAdmin(id: string, actor: Actor) {
  const existing = await getDoc(bannerDoc(id));
  if (!existing.exists() || !belongsToStore(existing.data()))
    throw new Error("Record not found.");
  await deleteDoc(bannerDoc(id));
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "banner.delete",
    resourceType: "banner",
    resourceId: id,
  });
}
