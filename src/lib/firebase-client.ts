import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

export const firebaseMode = import.meta.env["VITE_BACKEND_MODE"] !== "demo";
export const emulatorMode =
  import.meta.env.DEV && import.meta.env["VITE_FIREBASE_EMULATORS"] === "true";
let runtime: ReturnType<typeof initialize> | undefined;
function initialize() {
  if (typeof window === "undefined") throw new Error("Firebase client requires a browser.");
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: "AIzaSyCJNV4KyiDDdvPL-_pTW8xqQ3igrhd8dRU",
        authDomain: "zenvexa-c8d84.firebaseapp.com",
        projectId: "zenvexa-c8d84",
        storageBucket: "zenvexa-c8d84.firebasestorage.app",
        messagingSenderId: "606880758097",
        appId: "1:606880758097:web:c1178f0aef19691e02fb70",
        measurementId: "G-TR64KC6FNP",
      });
  if (!emulatorMode) {
    const siteKey = import.meta.env["VITE_FIREBASE_APP_CHECK_SITE_KEY"];
    if (siteKey)
      initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
  }
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, "europe-west1");
  const storage = getStorage(app);
  if (emulatorMode) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  return { auth, db, functions, storage };
}
export function firebaseClient() {
  return (runtime ??= initialize());
}
export async function callBackend<T>(name: string, data: unknown): Promise<T> {
  if (!emulatorMode && !import.meta.env["VITE_FIREBASE_APP_CHECK_SITE_KEY"])
    throw new Error(
      "Protected backend operations require the configured App Check site key. Public catalogue browsing does not grant staff or checkout access.",
    );
  const result = await httpsCallable<unknown, T>(firebaseClient().functions, name)(data);
  return result.data;
}
