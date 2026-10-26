import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { COLLECTIONS } from "@/constants/collections";
import { getDb } from "@/firebase/firestore";
import { writeAuditLog } from "@/services/audit.service";
import type { Banner, BannerDocument } from "@/types/admin";

type Actor = { id: string; email?: string };

function bannersCollection() {
  return collection(getDb(), COLLECTIONS.banners);
}

function bannerDoc(id: string) {
  return doc(getDb(), COLLECTIONS.banners, id);
}

export async function listBannersAdmin(): Promise<Banner[]> {
  const snapshot = await getDocs(bannersCollection());
  return snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as BannerDocument) }))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

export async function createBannerAdmin(
  input: Omit<BannerDocument, "createdAt" | "updatedAt">,
  actor: Actor,
) {
  const payload: BannerDocument = {
    ...input,
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
  await updateDoc(bannerDoc(id), {
    ...patch,
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
  await deleteDoc(bannerDoc(id));
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "banner.delete",
    resourceType: "banner",
    resourceId: id,
  });
}
