/**
 * Shared Firebase Admin helpers for ShopBeta scripts.
 *
 * Credentials resolve in order:
 *   1. --credentials=<path> (or an explicit path argument)
 *   2. GOOGLE_APPLICATION_CREDENTIALS
 *   3. FIREBASE_SERVICE_ACCOUNT (raw JSON string)
 */
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/** Parse CLI flags/options from `process.argv` (or a provided argv slice). */
export function parseArgs(argv = process.argv.slice(2)) {
  const flag = (name) => argv.includes(`--${name}`);
  const option = (name) =>
    argv
      .find((arg) => arg.startsWith(`--${name}=`))
      ?.split("=")
      .slice(1)
      .join("=");
  return { args: argv, flag, option };
}

/** Load a service-account JSON object from path or environment. */
export function loadCredentials(credentialsPath) {
  const path = credentialsPath ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    return JSON.parse(readFileSync(path, "utf8"));
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  throw new Error(
    "No credentials. Pass --credentials=<service-account.json> or set GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT.",
  );
}

function ensureAdminApp(credentialsPath) {
  if (!getApps().length) {
    initializeApp({ credential: cert(loadCredentials(credentialsPath)) });
  }
}

/** Initialize (once) and return a Firestore Admin instance. */
export function getAdminFirestore(credentialsPath) {
  ensureAdminApp(credentialsPath);
  return getFirestore();
}

/** Initialize (once) and return a Firebase Auth Admin instance. */
export function getAdminAuth(credentialsPath) {
  ensureAdminApp(credentialsPath);
  return getAuth();
}

export const STAFF_ROLES = [
  "super_admin",
  "admin",
  "inventory_manager",
  "order_manager",
  "customer_support",
  "marketing_manager",
  "staff",
];

export const ALL_USER_ROLES = ["customer", ...STAFF_ROLES];
