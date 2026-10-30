import { randomBytes } from "node:crypto";

export async function provisionSuperAdmin(auth, db, email) {
  const normalized = email.trim().toLowerCase();
  const profiles = await db.collection("users").where("email", "==", normalized).get();
  let user;
  try {
    user = await auth.getUserByEmail(normalized);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }
  if (user) {
    const profile = await db.collection("users").doc(user.uid).get();
    if (user.disabled || !profile.exists || profile.data().role !== "super_admin" ||
        profile.data().email !== normalized || profile.data().status !== "active" ||
        profiles.docs.some((doc) => doc.id !== user.uid)) {
      throw new Error("Existing account conflicts with bootstrap; no identity, password or role was changed.");
    }
    return { created: false };
  }
  if (!profiles.empty) throw new Error("Existing profile conflicts with bootstrap; no changes made.");
  user = await auth.createUser({
    email: normalized,
    password: randomBytes(48).toString("base64url"),
    displayName: "Super Admin",
    emailVerified: false,
  });
  const now = new Date();
  await db.collection("users").doc(user.uid).create({
    uid: user.uid, email: normalized, displayName: "Super Admin",
    role: "super_admin", status: "active", active: true,
    createdAt: now, updatedAt: now,
  });
  return { created: true };
}
