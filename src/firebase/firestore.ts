import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "./app";

let firestore: Firestore | undefined;

export function getDb(): Firestore {
  firestore ??= getFirestore(getFirebaseApp());
  return firestore;
}
