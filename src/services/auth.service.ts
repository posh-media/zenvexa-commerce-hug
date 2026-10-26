import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth } from "@/firebase/auth";
import { getUserById, upsertUserProfile } from "@/services/users.service";
import type { UserProfile } from "@/types/user";

export type AuthResult =
  | { ok: true; user: User; profile: UserProfile }
  | { ok: false; reason: string };

function mapAuthError(error: unknown): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists with this email.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completing.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      return error instanceof Error
        ? error.message
        : "Authentication failed. Please try again.";
  }
}

async function ensurePersistence() {
  await setPersistence(getFirebaseAuth(), browserLocalPersistence);
}

/** Create or load the Firestore profile for an Auth user. */
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const existing = await getUserById(user.uid);
  if (existing) {
    // Keep email / photo in sync from Auth without clobbering other fields.
    await upsertUserProfile(user.uid, {
      email: user.email ?? existing.email,
      displayName:
        user.displayName ?? existing.displayName ?? existing.display_name,
      display_name:
        user.displayName ?? existing.display_name ?? existing.displayName,
      photoUrl: user.photoURL ?? existing.photoUrl,
      status: existing.status ?? "active",
      updatedAt: serverTimestamp() as UserProfile["updatedAt"],
    });
    return (await getUserById(user.uid)) ?? { ...existing, id: user.uid };
  }

  const displayName = user.displayName ?? user.email?.split("@")[0] ?? "Shopper";
  await upsertUserProfile(user.uid, {
    uid: user.uid,
    email: user.email ?? undefined,
    displayName,
    display_name: displayName,
    photoUrl: user.photoURL ?? undefined,
    role: "customer",
    status: "active",
    created_time: serverTimestamp() as UserProfile["created_time"],
    createdAt: serverTimestamp() as UserProfile["createdAt"],
    updatedAt: serverTimestamp() as UserProfile["updatedAt"],
  });

  return (
    (await getUserById(user.uid)) ?? {
      id: user.uid,
      uid: user.uid,
      email: user.email ?? undefined,
      displayName,
      role: "customer",
      status: "active",
    }
  );
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  try {
    await ensurePersistence();
    const credential = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email.trim(),
      password,
    );
    if (displayName.trim()) {
      await updateProfile(credential.user, {
        displayName: displayName.trim(),
      });
    }
    // Architecture ready — send verification when Email Verification is enabled
    // in the Firebase console. Failures are non-blocking.
    try {
      await sendEmailVerification(credential.user);
    } catch {
      // Provider may not be enabled yet.
    }
    const profile = await ensureUserProfile(credential.user);
    return { ok: true, user: credential.user, profile };
  } catch (error) {
    return { ok: false, reason: mapAuthError(error) };
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    await ensurePersistence();
    const credential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      email.trim(),
      password,
    );
    const profile = await ensureUserProfile(credential.user);
    return { ok: true, user: credential.user, profile };
  } catch (error) {
    return { ok: false, reason: mapAuthError(error) };
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    await ensurePersistence();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(getFirebaseAuth(), provider);
    const profile = await ensureUserProfile(credential.user);
    return { ok: true, user: credential.user, profile };
  } catch (error) {
    return { ok: false, reason: mapAuthError(error) };
  }
}

export async function resetPassword(email: string): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: mapAuthError(error) };
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function subscribeToAuth(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function updateAuthProfile(input: {
  displayName?: string;
  photoURL?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const user = getFirebaseAuth().currentUser;
    if (!user) return { ok: false, reason: "You must be signed in." };
    await updateProfile(user, {
      displayName: input.displayName ?? user.displayName,
      photoURL:
        input.photoURL === undefined ? user.photoURL : input.photoURL,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: mapAuthError(error) };
  }
}

export function getCurrentAuthUser(): User | null {
  return getFirebaseAuth().currentUser;
}
