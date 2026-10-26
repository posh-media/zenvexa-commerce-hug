import type { Timestamp } from "firebase/firestore";

/** Value Firestore may return for a date-ish field. */
export type FirestoreDate = Timestamp | Date | string | number;

/** Fields every Zenvexa document carries once Phase 2 writes land. */
export type Timestamps = {
  createdAt?: FirestoreDate;
  updatedAt?: FirestoreDate;
};

/** A document as consumed by the app: raw data plus its Firestore id. */
export type WithId<T> = T & { id: string };
