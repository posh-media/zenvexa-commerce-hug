import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/firebase/firestore";

export type MonnifySecrets = {
  sandboxApiKey?: string;
  sandboxSecretKey?: string;
  sandboxContractCode?: string;
  liveApiKey?: string;
  liveSecretKey?: string;
  liveContractCode?: string;
};

/** Blank fields preserve saved values. Credentials are never read by the browser. */
export async function saveMonnifySecrets(input: MonnifySecrets) {
  const patch = Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value?.trim())
      .map(([key, value]) => [key, value!.trim()]),
  );
  if (!Object.keys(patch).length) return;
  await setDoc(
    doc(getDb(), "privatePaymentSettings", "monnify"),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
