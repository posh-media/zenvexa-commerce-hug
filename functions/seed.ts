import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export async function seedEmulator(records: [string, object][]) {
  if (
    !/^(localhost|127\.0\.0\.1):\d+$/.test(process.env["FIRESTORE_EMULATOR_HOST"] ?? "") ||
    process.env["ZENVEXA_SEED"] !== "emulator"
  )
    throw new Error("Seed is restricted to explicit loopback emulator use.");
  const app = initializeApp({ projectId: "zenvexa-c8d84" }, "seed");
  const db = getFirestore(app);
  try {
    for (const [path, data] of records)
      await db.runTransaction(async (transaction) => {
        const ref = db.doc(path);
        if (!(await transaction.get(ref)).exists)
          transaction.create(ref, {
            ...data,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
      });
    return (await db.collection("products").get()).size;
  } finally {
    await deleteApp(app);
  }
}
