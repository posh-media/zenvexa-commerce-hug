import { settingsDoc } from "@/firebase/collections";
import { getDb } from "@/firebase/firestore";
import {
  deploymentStoreId,
  requireStoreName,
  settingsDocumentId,
  providerDocumentSegments,
} from "@/lib/store";
import { writeAuditLog } from "@/services/audit.service";
import type { AppSettings, AppSettingsDocument } from "@/types/settings";
import { stripUndefined } from "@/utils/firestore";
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const SECRET_PROVIDERS = ["paystack", "korapay", "flutterwave"] as const;
type SecretProvider = (typeof SECRET_PROVIDERS)[number];

export async function getAppSettings(): Promise<AppSettings | undefined> {
  let data: AppSettings | undefined;
  if (typeof window === "undefined") {
    const { storeSettingsRef, currentStoreId } =
      await import("@/lib/server/store-context");
    const snapshot = await storeSettingsRef().get();
    data = snapshot.exists
      ? ({
          id: snapshot.id,
          ...snapshot.data(),
          storeId: snapshot.data()?.storeId || currentStoreId(),
        } as AppSettings)
      : undefined;
  } else {
    const snapshot = await getDoc(settingsDoc());
    data = snapshot.exists() ? snapshot.data() : undefined;
  }
  if (!data) return undefined;
  // Never return secret fields from a public settings reader, including the legacy doc.
  const { paymentSecrets: _secrets, ...publicData } = data;
  void _secrets;
  if (publicData.notifications) {
    const {
      makeWebhookUrl: _make,
      transactionalEmailWebhookUrl: _mail,
      ...notifications
    } = publicData.notifications;
    void _make;
    void _mail;
    publicData.notifications = notifications;
  }
  return publicData;
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
  for (const [key, nested] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (
      /secret|webhook|apikey|privatekey/i.test(key) &&
      typeof nested === "string"
    ) {
      clone[key] = nested ? "[redacted]" : "";
    } else if (
      key === "paymentSecrets" &&
      nested &&
      typeof nested === "object"
    ) {
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

  const name = requireStoreName(merged as AppSettings, deploymentStoreId());
  merged.storeId = deploymentStoreId();
  merged.storeInformation = { ...(merged.storeInformation as object), name };
  // Sensitive integration URLs are private, even though old clients used settings/app.
  const integrations: Record<string, string> = {};
  for (const field of [
    "makeWebhookUrl",
    "transactionalEmailWebhookUrl",
  ] as const) {
    const value = patch.notifications?.[field]?.trim();
    if (value) integrations[field] = value;
    if (merged.notifications)
      delete (merged.notifications as Record<string, unknown>)[field];
  }
  if (Object.keys(integrations).length)
    await setDoc(
      doc(getDb(), "privateStoreSettings", deploymentStoreId()),
      { ...integrations, updatedAt: serverTimestamp() },
      { merge: true },
    );
  if (patch.paymentSecrets) await saveProviderSecrets(patch.paymentSecrets);
  delete merged.paymentSecrets;

  await setDoc(
    settingsDoc(),
    stripUndefined({
      ...merged,
      paymentSecrets: deleteField(),
      storeName: deleteField(),
      notifications: {
        ...(merged.notifications as object),
        makeWebhookUrl: deleteField(),
        transactionalEmailWebhookUrl: deleteField(),
      },
      updatedAt: serverTimestamp(),
    }),
    { merge: true },
  );
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "settings.update",
    resourceType: "settings",
    resourceId: settingsDocumentId(),
    previousValue: redactSecrets(existing ?? null),
    newValue: redactSecrets(patch),
  });
}

const privateSecretDoc = (provider: SecretProvider) =>
  doc(
    getDb(),
    ...(providerDocumentSegments(provider) as [string, ...string[]]),
  );

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
  requireStoreName(await getAppSettings());
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

/** Compatibility no-op. Legacy migration now requires an explicit backed-up plan. */
export async function migrateLegacyPaymentSecrets() {
  // Explicit, backed-up migration is provided by scripts/migrate-store-data.mjs.
}

export async function getPaymentSecrets() {
  return {};
}

// Server-side only function to check if a payment provider is enabled
export async function isPaymentProviderEnabled(
  provider: "paystack" | "korapay" | "flutterwave",
): Promise<boolean> {
  const settings = await getAppSettings();

  // Check Firestore first
  const firestoreEnabled = settings?.payments?.[`${provider}Enabled`];
  if (firestoreEnabled !== undefined) {
    return firestoreEnabled;
  }

  // Fallback to environment variables during migration
  switch (provider) {
    case "paystack":
      return process.env.NEXT_PUBLIC_ENABLE_PAYSTACK === "true";
    case "korapay":
      return process.env.NEXT_PUBLIC_ENABLE_KORAPAY === "true";
    case "flutterwave":
      return process.env.NEXT_PUBLIC_ENABLE_FLUTTERWAVE === "true";
    default:
      return false;
  }
}

// Server-side only function to get payment secret key
export async function getPaymentSecretKey(
  provider: "paystack" | "korapay" | "flutterwave",
): Promise<string | undefined> {
  if (typeof window === "undefined") {
    const { providerSecrets, deploymentEnv, legacyCredentialsAllowed } =
      await import("@/lib/server/store-context");
    const data = await providerSecrets(provider);
    if (typeof data.secretKey === "string" && data.secretKey.trim())
      return data.secretKey.trim();
    // Legacy public secret fields are read only on the server, and only for ShopBeta.
    if (legacyCredentialsAllowed()) {
      const { getAdminDb } = await import("@/lib/server/firebase-admin");
      const legacy = (
        await getAdminDb().collection("settings").doc("app").get()
      ).data()?.paymentSecrets?.[`${provider}SecretKey`];
      if (typeof legacy === "string" && legacy.trim()) return legacy.trim();
    }
    return deploymentEnv(`${provider.toUpperCase()}_SECRET_KEY`)?.trim();
  }
  throw new Error("Provider secrets are server-only.");
}
