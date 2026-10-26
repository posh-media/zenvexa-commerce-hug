import { getDocs, limit as limitTo, query, where } from "firebase/firestore";
import { couponsCollection } from "@/firebase/collections";
import type { Coupon } from "@/types/coupon";

export async function getCouponByCode(
  code: string,
): Promise<Coupon | undefined> {
  const snapshot = await getDocs(
    query(couponsCollection(), where("code", "==", code), limitTo(1)),
  );
  return snapshot.docs[0]?.data();
}

export async function listCoupons(max?: number): Promise<Coupon[]> {
  const snapshot = await getDocs(
    max != null
      ? query(couponsCollection(), limitTo(max))
      : query(couponsCollection()),
  );
  return snapshot.docs.map((document) => document.data());
}
