#!/usr/bin/env node
/**
 * ONE-TIME Super Admin bootstrap for ShopBeta.
 *
 * Creates (or finds) a Firebase Auth user and sets Firestore
 * `users/{uid}.role = "super_admin"`. Uses the Admin SDK so it does not
 * require manual Firestore editing and bypasses client security rules.
 *
 * Safety:
 *   - Refuses if ADMIN_BOOTSTRAP_DISABLED=true|1
 *   - Refuses if any super_admin / admin already exists (unless --force)
 *   - Writes settings/bootstrap so future runs know setup completed
 *
 * Usage:
 *   npm run admin:bootstrap -- --email=you@example.com --password=Secret123!
 *   npm run admin:bootstrap -- --email=you@example.com --password=Secret123! --credentials=./sa.json
 *
 * After success: sign in at /login, then open /admin.
 * Disable permanently: set ADMIN_BOOTSTRAP_DISABLED=true in the environment
 * used for scripts, or simply do not run this command again.
 */

import {
  getAdminAuth,
  getAdminFirestore,
  parseArgs,
} from "./lib/admin.mjs";

const BOOTSTRAP_DOC = "bootstrap";
const SETTINGS_COLLECTION = "settings";

async function findExistingAdmins(db) {
  const roles = ["super_admin", "admin"];
  const found = [];
  for (const role of roles) {
    const snap = await db.collection("users").where("role", "==", role).limit(5).get();
    for (const doc of snap.docs) {
      found.push({ id: doc.id, role: doc.data().role, email: doc.data().email });
    }
  }
  return found;
}

async function main() {
  const { flag, option } = parseArgs();
  const email = option("email")?.trim().toLowerCase();
  const password = option("password");
  const displayName = option("display-name")?.trim() || "Super Admin";
  const credentials = option("credentials");
  const force = flag("force");

  if (
    process.env.ADMIN_BOOTSTRAP_DISABLED === "1" ||
    process.env.ADMIN_BOOTSTRAP_DISABLED?.toLowerCase() === "true"
  ) {
    console.error(
      "Bootstrap is disabled (ADMIN_BOOTSTRAP_DISABLED). Use npm run admin:set-role instead.",
    );
    process.exit(1);
  }

  if (!email) {
    console.error(
      "Usage: npm run admin:bootstrap -- --email=you@example.com --password=Secret123!",
    );
    process.exit(1);
  }

  const db = getAdminFirestore(credentials);
  const auth = getAdminAuth(credentials);

  const existingAdmins = await findExistingAdmins(db);
  const bootstrapSnap = await db
    .collection(SETTINGS_COLLECTION)
    .doc(BOOTSTRAP_DOC)
    .get();

  if ((existingAdmins.length > 0 || bootstrapSnap.exists) && !force) {
    console.error("Bootstrap blocked — an admin already exists (or bootstrap was completed).");
    if (existingAdmins.length) {
      console.error(
        "Existing:",
        existingAdmins
          .map((a) => `${a.email || a.id} (${a.role})`)
          .join(", "),
      );
    }
    console.error(
      "To add more staff: npm run admin:set-role -- --email=... --role=admin",
    );
    console.error("To override (dangerous): add --force");
    process.exit(1);
  }

  let user;
  try {
    user = await auth.getUserByEmail(email);
    console.log(`Found Auth user ${user.uid} for ${email}`);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    if (!password || password.length < 6) {
      console.error(
        "Auth user not found. Provide --password=... (min 6 chars) to create one.",
      );
      process.exit(1);
    }
    user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
    console.log(`Created Auth user ${user.uid} for ${email}`);
  }

  const now = new Date();
  const userRef = db.collection("users").doc(user.uid);
  const existingProfile = await userRef.get();
  const profilePayload = {
    uid: user.uid,
    email,
    displayName: user.displayName || displayName,
    display_name: user.displayName || displayName,
    role: "super_admin",
    status: "active",
    active: true,
    updatedAt: now,
  };
  if (!existingProfile.exists) {
    profilePayload.createdAt = now;
    profilePayload.created_time = now;
  }

  await userRef.set(profilePayload, { merge: true });

  await db
    .collection(SETTINGS_COLLECTION)
    .doc(BOOTSTRAP_DOC)
    .set(
      {
        completed: true,
        completedAt: now,
        superAdminUid: user.uid,
        superAdminEmail: email,
        note: "Initial Super Admin bootstrap. Do not re-run unless using --force.",
      },
      { merge: true },
    );

  console.log("");
  console.log("Super Admin ready.");
  console.log(`  Email: ${email}`);
  console.log(`  UID:   ${user.uid}`);
  console.log(`  Role:  super_admin`);
  console.log("");
  console.log("Next: sign in at /login, then open /admin");
  console.log(
    "Disable bootstrap: set ADMIN_BOOTSTRAP_DISABLED=true (or never run this again).",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
