import { couponsCollection } from "@/firebase/collections";
import { storeDocuments } from "@/lib/store-queries";
import type { Coupon } from "@/types/coupon";
import { where } from "firebase/firestore";

export async function getCouponByCode(
  code: string,
): Promise<Coupon | undefined> {
  const docs = await storeDocuments(couponsCollection(), [
    where("code", "==", code),
  ]);
  return docs[0]?.data();
}

export async function listCoupons(max?: number): Promise<Coupon[]> {
  const docs = await storeDocuments(couponsCollection());
  return (max == null ? docs : docs.slice(0, max)).map((doc) => doc.data());
}
