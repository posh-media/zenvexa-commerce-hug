import { couponDoc, couponsCollection } from "@/firebase/collections";
import { belongsToStore, deploymentStoreId } from "@/lib/store";
import { storeDocuments } from "@/lib/store-queries";
import { writeAuditLog } from "@/services/audit.service";
import type { Coupon, CouponDocument } from "@/types/coupon";
import {
  addDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

type Actor = { id: string; email?: string };

export async function listCouponsAdmin(): Promise<Coupon[]> {
  const documents = await storeDocuments(couponsCollection());
  return documents.map((d) => d.data());
}

export async function createCouponAdmin(
  input: Omit<CouponDocument, "createdAt" | "updatedAt">,
  actor: Actor,
) {
  const payload: CouponDocument = {
    ...input,
    storeId: deploymentStoreId(),
    code: input.code.trim().toUpperCase(),
    active: input.active !== false,
    usedCount: input.usedCount ?? 0,
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };
  const ref = await addDoc(couponsCollection(), payload);
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "coupon.create",
    resourceType: "coupon",
    resourceId: ref.id,
    newValue: { code: payload.code },
  });
  return ref.id;
}

export async function updateCouponAdmin(
  id: string,
  patch: Partial<CouponDocument>,
  actor: Actor,
) {
  const next = {
    ...patch,
    storeId: deploymentStoreId(),
    ...(patch.code ? { code: patch.code.trim().toUpperCase() } : {}),
    updatedAt: serverTimestamp(),
  };
  const existing = await getDoc(couponDoc(id));
  if (!existing.exists() || !belongsToStore(existing.data()))
    throw new Error("Record not found.");
  await updateDoc(couponDoc(id), next);
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "coupon.update",
    resourceType: "coupon",
    resourceId: id,
    newValue: patch,
  });
}

export async function deleteCouponAdmin(id: string, actor: Actor) {
  const existing = await getDoc(couponDoc(id));
  if (!existing.exists() || !belongsToStore(existing.data()))
    throw new Error("Record not found.");
  await deleteDoc(couponDoc(id));
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "coupon.delete",
    resourceType: "coupon",
    resourceId: id,
  });
}
