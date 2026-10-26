import { getDoc, getDocs, query, where } from "firebase/firestore";
import { reviewDoc, reviewsCollection } from "@/firebase/collections";
import type { Review } from "@/types/commerce";

export async function listReviewsByProduct(
  productId: string,
): Promise<Review[]> {
  const snapshot = await getDocs(
    query(reviewsCollection(), where("productId", "==", productId)),
  );
  return snapshot.docs.map((document) => document.data());
}

export async function getReview(id: string): Promise<Review | undefined> {
  const snapshot = await getDoc(reviewDoc(id));
  return snapshot.exists() ? snapshot.data() : undefined;
}
