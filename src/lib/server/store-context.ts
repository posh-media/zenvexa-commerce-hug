import { getAdminDb } from "@/lib/server/firebase-admin";
import {
  deploymentStoreId,
  settingsDocumentId,
  type StoreId,
} from "@/lib/store";
import { AsyncLocalStorage } from "node:async_hooks";
export type StoreContext = {
  id: StoreId;
  storeName?: string;
  credentialVersion?: string;
  sandbox?: boolean;
  legacyAttempt?: boolean;
};
const context = new AsyncLocalStorage<StoreContext>();
export const currentStoreContext = () =>
  context.getStore() || { id: deploymentStoreId() };
export const currentStoreId = () => currentStoreContext().id;
export function withStoreContext<T>(value: StoreContext, action: () => T): T {
  return context.run(value, action);
}
export function storeSettingsRef(id = currentStoreId()) {
  return getAdminDb().collection("settings").doc(settingsDocumentId(id));
}
export function privateProviderRef(provider: string, id = currentStoreId()) {
  const version = currentStoreContext().credentialVersion;
  const ref = getAdminDb()
    .collection("privatePaymentSettings")
    .doc(id)
    .collection("providers")
    .doc(provider);
  return version ? ref.collection("versions").doc(version) : ref;
}
export function deploymentEnv(name: string): string | undefined {
  // A shared webhook may handle either store, but must never borrow the receiving deployment's credentials.
  if (
    currentStoreContext().credentialVersion &&
    /SECRET|API_KEY|CONTRACT_CODE/.test(name)
  )
    return undefined;
  return currentStoreId() === deploymentStoreId()
    ? process.env[name]
    : undefined;
}
export function legacyCredentialsAllowed() {
  return (
    currentStoreId() === "shopbeta" &&
    (currentStoreContext().legacyAttempt ||
      settingsDocumentId("shopbeta") === "app")
  );
}
export async function providerSecrets(provider: string) {
  if (!currentStoreContext().credentialVersion && legacyCredentialsAllowed()) {
    const legacy = await getAdminDb()
      .collection("privatePaymentSettings")
      .doc(provider)
      .get();
    if (legacy.exists) return legacy.data() || {};
  }
  const snap = await privateProviderRef(provider).get();
  if (snap.exists) return snap.data() || {};
  if (currentStoreContext().credentialVersion)
    throw new Error("Recorded provider credential version is unavailable.");
  return {};
}
export async function privateIntegrationSettings() {
  return (
    (
      await getAdminDb()
        .collection("privateStoreSettings")
        .doc(currentStoreId())
        .get()
    ).data() || {}
  );
}
