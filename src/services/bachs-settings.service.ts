import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb } from "@/firebase/firestore";

/** Write-only from admin; secret values are never returned to the browser. */
export async function saveBachsSecrets(input: {
  sandboxApiKey?: string;
  liveApiKey?: string;
  sandboxWebhookSecret?: string;
  liveWebhookSecret?: string;
}) {
  const patch = Object.fromEntries(
    Object.entries({
      sandboxApiKey: input.sandboxApiKey,
      liveApiKey: input.liveApiKey,
      sandboxWebhookSecret: input.sandboxWebhookSecret,
      liveWebhookSecret: input.liveWebhookSecret,
    })
      .filter(([, v]) => typeof v === "string" && v.trim())
      .map(([k, v]) => [k, (v as string).trim()]),
  );
  if (!Object.keys(patch).length) return;
  await setDoc(
    doc(getDb(), "privatePaymentSettings", "bachs"),
    {
      ...patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
