import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseApp } from "./app";

let storage: FirebaseStorage | undefined;

export function getFirebaseStorage(): FirebaseStorage {
  storage ??= getStorage(getFirebaseApp());
  return storage;
}
