import { getFirebaseAuth } from "@/firebase/auth";
import { signInAnonymously, type UserCredential } from "firebase/auth";
let guestSignIn: Promise<UserCredential> | undefined;
export async function authenticatedFetch(url: string, init: RequestInit = {}) {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser && !guestSignIn)
    guestSignIn = signInAnonymously(auth).finally(() => {
      guestSignIn = undefined;
    });
  const user = auth.currentUser || (await guestSignIn!).user;
  const token = await user.getIdToken();
  return fetch(url, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers)),
      Authorization: `Bearer ${token}`,
    },
  });
}
