import { existsSync, readFileSync } from "node:fs";
import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | undefined;
let db: Firestore | undefined;

function parseServiceAccountJson(raw: string): ServiceAccount {
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT must be valid JSON (service account key).",
    );
  }
}

function loadServiceAccount(): ServiceAccount | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) return parseServiceAccountJson(raw);

  const path =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (path && existsSync(path)) {
    return parseServiceAccountJson(readFileSync(path, "utf8"));
  }
  return undefined;
}

/** True when Admin SDK has explicit credentials (not projectId-only). */
export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT?.trim() ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
  );
}

/**
 * Firebase Admin for payment verification / order finalization.
 * Requires FIREBASE_SERVICE_ACCOUNT JSON, FIREBASE_SERVICE_ACCOUNT_PATH,
 * or GOOGLE_APPLICATION_CREDENTIALS. Does not initialize with projectId alone
 * (that previously caused silent credential failures at query time).
 */
export function getAdminApp(): App {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }

  const serviceAccount = loadServiceAccount();
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  if (!serviceAccount) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT (JSON string) or GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT_PATH to a service-account key file.",
    );
  }

  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId || projectId,
  });
  return app;
}

export function getAdminDb(): Firestore {
  if (db) return db;
  db = getFirestore(getAdminApp());
  return db;
}
