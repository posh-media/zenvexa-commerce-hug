import { getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { settingsDoc } from "@/firebase/collections";
import { writeAuditLog } from "@/services/audit.service";
import type { AppSettings, AppSettingsDocument } from "@/types/settings";

export async function getAppSettings(): Promise<AppSettings | undefined> {
  const snapshot = await getDoc(settingsDoc());
  return snapshot.exists() ? snapshot.data() : undefined;
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
  await setDoc(
    settingsDoc(),
    {
      ...current,
      ...patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "settings.update",
    resourceType: "settings",
    resourceId: "app",
    previousValue: existing ?? null,
    newValue: patch,
  });
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
  const secrets = await getPaymentSecrets();
  
  // Check Firestore first
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
