import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { settingsDoc } from "@/firebase/collections";
import { getDb } from "@/firebase/firestore";
import { writeAuditLog } from "@/services/audit.service";
import { stripUndefined } from "@/utils/firestore";
import type { AppSettings, AppSettingsDocument } from "@/types/settings";

const SECRET_PROVIDERS = ["paystack", "korapay", "flutterwave"] as const;
type SecretProvider = (typeof SECRET_PROVIDERS)[number];

export async function getAppSettings(): Promise<AppSettings | undefined> {
  const snapshot = await getDoc(settingsDoc());
  return snapshot.exists() ? snapshot.data() : undefined;
}

/** Nested objects merged field-by-field so partial updates don't drop subfields. */
const NESTED_KEYS = [
  "storeInformation",
  "contactDetails",
  "socialLinks",
  "payments",
  "notifications",
  "theme",
] as const;

/** Replace every secret value with a marker before values reach the audit log. */
function redactSecrets(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const clone: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key === "paymentSecrets" && nested && typeof nested === "object") {
      clone[key] = Object.fromEntries(
        Object.keys(nested as Record<string, unknown>).map((k) => [
          k,
          "[redacted]",
        ]),
      );
    } else {
      clone[key] = redactSecrets(nested);
    }
  }
  return clone;
}

export async function updateAppSettings(
  patch: Partial<AppSettingsDocument>,
  actor: { id: string; email?: string },
) {
  const existing = await getAppSettings();
  const { id: _settingsId, ...current } = (existing ?? {}) as AppSettings & {
    id?: string;
  };
  void _settingsId;

  const merged: Record<string, unknown> = { ...current, ...patch };
  for (const key of NESTED_KEYS) {
    const nested = patch[key];
    if (nested !== undefined && typeof nested === "object" && nested !== null) {
      merged[key] = {
        ...((current[key] as Record<string, unknown> | undefined) ?? {}),
        ...(nested as Record<string, unknown>),
      };
    }
  }

  // Secrets: only an explicit non-empty value may replace a stored key.
  // Blank/whitespace/undefined values are dropped so they can never erase
  // existing credentials.
  if (patch.paymentSecrets !== undefined) {
    const clean = Object.fromEntries(
      Object.entries(patch.paymentSecrets)
        .filter(([, value]) => typeof value === "string" && value.trim())
        .map(([key, value]) => [key, (value as string).trim()]),
    );
    merged.paymentSecrets = {
      ...(current.paymentSecrets ?? {}),
      ...clean,
    };
  }

  await setDoc(
    settingsDoc(),
    stripUndefined({
      ...merged,
      updatedAt: serverTimestamp(),
    }) as AppSettingsDocument,
    { merge: true },
  );
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "settings.update",
    resourceType: "settings",
    resourceId: "app",
    previousValue: redactSecrets(existing ?? null),
    newValue: redactSecrets(patch),
  });
}

const privateSecretDoc = (provider: SecretProvider) =>
  doc(getDb(), "privatePaymentSettings", provider);

/**
 * Write provider secret keys to the write-only `privatePaymentSettings`
 * collection — the same pattern as Squad/Monnify. Blank or whitespace-only
 * values are ignored so a blank form field can never erase a saved key.
 */
export async function saveProviderSecrets(input: {
  paystackSecretKey?: string;
  korapaySecretKey?: string;
  flutterwaveSecretKey?: string;
}) {
  const writes: Array<Promise<unknown>> = [];
  for (const provider of SECRET_PROVIDERS) {
    const value = input[`${provider}SecretKey`]?.trim();
    if (!value) continue;
    writes.push(
      setDoc(
        privateSecretDoc(provider),
        { secretKey: value, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  }
  await Promise.all(writes);
}

/**
 * One-time migration: legacy `settings/app.paymentSecrets` keys are copied
 * into `privatePaymentSettings/{provider}` and the publicly-readable
 * `paymentSecrets` field is removed from the settings document.
 * Safe to call on every admin save — it no-ops when there is nothing to move.
 */
export async function migrateLegacyPaymentSecrets() {
  const settings = await getAppSettings();
  const legacy = settings?.paymentSecrets;
  if (!legacy) return;

  const writes: Array<Promise<unknown>> = [];
  for (const provider of SECRET_PROVIDERS) {
    const value = legacy[`${provider}SecretKey`]?.trim();
    if (!value) continue;
    writes.push(
      setDoc(
        privateSecretDoc(provider),
        { secretKey: value, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  }
  await Promise.all(writes);

  await setDoc(
    settingsDoc(),
    { paymentSecrets: deleteField() },
    { merge: true },
  );
}

// Server-side only function to get payment secrets
export async function getPaymentSecrets() {
  const settings = await getAppSettings();
  return settings?.paymentSecrets || {};
}

// Server-side only function to check if a payment provider is enabled
export async function isPaymentProviderEnabled(provider: 'paystack' | 'korapay' | 'flutterwave'): Promise<boolean> {
  const settings = await getAppSettings();
  
  // Check Firestore first
  const firestoreEnabled = settings?.payments?.[`${provider}Enabled`];
  if (firestoreEnabled !== undefined) {
    return firestoreEnabled;
  }
  
  // Fallback to environment variables during migration
  switch (provider) {
    case 'paystack':
      return process.env.NEXT_PUBLIC_ENABLE_PAYSTACK === 'true';
    case 'korapay':
      return process.env.NEXT_PUBLIC_ENABLE_KORAPAY === 'true';
    case 'flutterwave':
      return process.env.NEXT_PUBLIC_ENABLE_FLUTTERWAVE === 'true';
    default:
      return false;
  }
}

// Server-side only function to get payment secret key
export async function getPaymentSecretKey(provider: 'paystack' | 'korapay' | 'flutterwave'): Promise<string | undefined> {
  // 1. Write-only private collection (authoritative once configured).
  if (typeof window === "undefined") {
    try {
      const { getAdminDb, isFirebaseAdminConfigured } = await import(
        "@/lib/server/firebase-admin"
      );
      if (isFirebaseAdminConfigured()) {
        const snap = await getAdminDb()
          .collection("privatePaymentSettings")
          .doc(provider)
          .get();
        const key = snap.data()?.secretKey;
        if (typeof key === "string" && key.trim()) {
          return key.trim();
        }
      }
    } catch {
      // Fall through to the legacy/env fallbacks below.
    }
  }

  // 2. Legacy `settings/app.paymentSecrets` (migrated away on next admin save).
  const secrets = await getPaymentSecrets();
  const firestoreKey = secrets[`${provider}SecretKey`];
  if (firestoreKey) {
    return firestoreKey;
  }
  
  // Fallback to environment variables during migration
  switch (provider) {
    case 'paystack':
      return process.env.PAYSTACK_SECRET_KEY;
    case 'korapay':
      return process.env.KORAPAY_SECRET_KEY;
    case 'flutterwave':
      return process.env.FLUTTERWAVE_SECRET_KEY;
    default:
      return undefined;
  }
}
