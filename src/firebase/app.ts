import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { assertFirebaseConfigured, firebaseConfig } from "./config";

export function getFirebaseApp(): FirebaseApp {
  assertFirebaseConfigured();
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}
