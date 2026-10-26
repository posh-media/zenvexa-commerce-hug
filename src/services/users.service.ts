import { getDoc, setDoc } from "firebase/firestore";
import { userDoc } from "@/firebase/collections";
import type { UserDocument, UserProfile } from "@/types/user";
import { stripUndefined } from "@/utils/firestore";

export async function getUserById(
  uid: string,
): Promise<UserProfile | undefined> {
  const snapshot = await getDoc(userDoc(uid));
  return snapshot.exists() ? snapshot.data() : undefined;
}

/** Create or merge a user profile document keyed by Auth uid. */
export async function upsertUserProfile(
  uid: string,
  data: Partial<UserDocument>,
): Promise<void> {
  await setDoc(
    userDoc(uid),
    stripUndefined({ ...data, uid, id: uid }) as UserProfile,
    { merge: true },
  );
}
