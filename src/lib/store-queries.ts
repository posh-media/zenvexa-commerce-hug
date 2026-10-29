import {
  getDocs,
  query,
  where,
  type CollectionReference,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { belongsToStore, deploymentStoreId } from "./store";
/** Transitional ShopBeta scan deliberately includes missing fields before pagination/counting.
 * Firestore cannot query absent fields. Zenvexa uses an indexed explicit storeId query.
 * Remove the legacy scan only after old writers are retired and attribution backfill is complete. */
export async function storeDocuments<T extends DocumentData>(
  collection: CollectionReference<T>,
  constraints: QueryConstraint[] = [],
) {
  const id = deploymentStoreId();
  const filters =
    id === "zenvexa"
      ? [where("storeId", "==", id), ...constraints]
      : constraints;
  const snapshot = await getDocs(query(collection, ...filters));
  return snapshot.docs.filter((doc) => belongsToStore(doc.data(), id));
}
