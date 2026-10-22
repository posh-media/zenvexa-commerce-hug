import {
  addDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { collection, doc } from "firebase/firestore";
import { getDb } from "@/firebase/firestore";
import { COLLECTIONS } from "@/constants/collections";
import { writeAuditLog } from "@/services/audit.service";
import type { Ad, AdDocument, AdInput } from "@/types/ads";

type Actor = { id: string; email?: string };

// Helper function to get ads collection
const adsCollection = () => collection(getDb(), COLLECTIONS.ads);
const adDoc = (id: string) => doc(getDb(), COLLECTIONS.ads, id);

export async function listAdsAdmin(): Promise<Ad[]> {
  const snapshot = await getDocs(adsCollection());
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as Ad))
    .sort((a, b) => {
      // Sort by date descending (newest first)
      const aDate = new Date(a.date).getTime();
      const bDate = new Date(b.date).getTime();
      return bDate - aDate;
    });
}

export async function createAdAdmin(input: AdInput, actor: Actor) {
  const isAds = input.type !== "other_expense";
  const payload: AdDocument = {
    type: isAds ? "ads" : "other_expense",
    // Ads-only fields are cleared for Other Expense records.
    platform: isAds ? input.platform.trim() : "",
    campaignName: isAds ? input.campaignName?.trim() || undefined : undefined,
    amount: Number(input.amount) || 0,
    date: input.date,
    description: input.description?.trim() || undefined,
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };
  
  const ref = await addDoc(adsCollection(), payload);
  
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ad.create",
    resourceType: "ad",
    resourceId: ref.id,
    newValue: { platform: payload.platform, amount: payload.amount },
  });
  
  return ref.id;
}

export async function updateAdAdmin(id: string, input: AdInput, actor: Actor) {
  const existing = await getAdAdmin(id);
  if (!existing) throw new Error("Ad expense not found.");
  
  const isAds = input.type !== "other_expense";
  const next: Record<string, unknown> = {
    type: isAds ? "ads" : "other_expense",
    // Ads-only fields are cleared for Other Expense records so stale
    // platform/campaign values never linger after a type switch.
    platform: isAds ? input.platform.trim() : "",
    campaignName: isAds
      ? input.campaignName?.trim() || deleteField()
      : deleteField(),
    amount: Number(input.amount) || 0,
    date: input.date,
    description: input.description?.trim() || deleteField(),
    updatedAt: serverTimestamp() as never,
  };
  
  await updateDoc(adDoc(id), next);
  
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ad.update",
    resourceType: "ad",
    resourceId: id,
    previousValue: { platform: existing.platform, amount: existing.amount },
    newValue: { platform: next.platform, amount: next.amount },
  });
}

export async function deleteAdAdmin(id: string, actor: Actor) {
  const existing = await getAdAdmin(id);
  if (!existing) throw new Error("Ad expense not found.");
  
  await deleteDoc(adDoc(id));
  
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ad.delete",
    resourceType: "ad",
    resourceId: id,
    previousValue: { platform: existing.platform, amount: existing.amount },
  });
}

export async function getAdAdmin(id: string) {
  const snapshot = await getDoc(adDoc(id));
  return snapshot.exists()
    ? ({ id: snapshot.id, ...snapshot.data() } as Ad)
    : undefined;
}

export function calculateTotalAdsExpenses(ads: Ad[]): number {
  return ads.reduce(
    (total, ad) =>
      total + ((ad.type ?? "ads") === "ads" ? ad.amount || 0 : 0),
    0,
  );
}

export function calculateTotalOtherExpenses(ads: Ad[]): number {
  return ads.reduce(
    (total, ad) =>
      total + (ad.type === "other_expense" ? ad.amount || 0 : 0),
    0,
  );
}

export function formatAdDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  } catch {
    return dateString;
  }
}
