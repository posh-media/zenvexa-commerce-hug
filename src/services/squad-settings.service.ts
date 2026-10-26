import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/firebase/firestore";

/** Write-only from admin; secret values are never returned to the browser. */
export async function saveSquadSecrets(input: {
  sandboxSecretKey?: string;
  liveSecretKey?: string;
}) {
  const patch = {
    ...(input.sandboxSecretKey?.trim()
      ? { sandboxSecretKey: input.sandboxSecretKey.trim() }
      : {}),
    ...(input.liveSecretKey?.trim()
      ? { liveSecretKey: input.liveSecretKey.trim() }
      : {}),
  };
  if (!Object.keys(patch).length) return;
  await setDoc(
    doc(getDb(), "privatePaymentSettings", "squad"),
    {
      ...patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
