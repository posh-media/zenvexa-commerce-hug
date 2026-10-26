import {
  addDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { couponDoc, couponsCollection } from "@/firebase/collections";
import { writeAuditLog } from "@/services/audit.service";
import type { Coupon, CouponDocument } from "@/types/coupon";

type Actor = { id: string; email?: string };

export async function listCouponsAdmin(): Promise<Coupon[]> {
  const snapshot = await getDocs(couponsCollection());
  return snapshot.docs.map((d) => d.data());
}

export async function createCouponAdmin(
  input: Omit<CouponDocument, "createdAt" | "updatedAt">,
  actor: Actor,
) {
  const payload: CouponDocument = {
    ...input,
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
    ...(patch.code ? { code: patch.code.trim().toUpperCase() } : {}),
    updatedAt: serverTimestamp(),
  };
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
  await deleteDoc(couponDoc(id));
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "coupon.delete",
    resourceType: "coupon",
    resourceId: id,
  });
}
