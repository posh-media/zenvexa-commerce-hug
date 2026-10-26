#!/usr/bin/env node
/**
 * Assign or remove ShopBeta staff roles for an existing Auth user.
 *
 * Uses the Firebase Admin SDK (bypasses client Firestore rules).
 * Prefer this after the first Super Admin exists — or use Admin → Customers.
 *
 * Usage:
 *   npm run admin:set-role -- --email=staff@example.com --role=inventory_manager
 *   npm run admin:set-role -- --email=staff@example.com --role=customer
 *   npm run admin:set-role -- --uid=<firebaseUid> --role=admin
 *
 * Roles:
 *   customer | super_admin | admin | inventory_manager | order_manager
 *   customer_support | marketing_manager | staff
 */

import {
  ALL_USER_ROLES,
  getAdminAuth,
  getAdminFirestore,
  parseArgs,
} from "./lib/admin.mjs";

async function main() {
  const { option } = parseArgs();
  const email = option("email")?.trim().toLowerCase();
  const uidArg = option("uid")?.trim();
  const role = option("role")?.trim();
  const credentials = option("credentials");
  const displayName = option("display-name")?.trim();

  if (!role || (!email && !uidArg)) {
    console.error(
      "Usage: npm run admin:set-role -- --email=user@example.com --role=admin",
    );
    console.error(`Roles: ${ALL_USER_ROLES.join(" | ")}`);
    process.exit(1);
  }

  if (!ALL_USER_ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Allowed: ${ALL_USER_ROLES.join(", ")}`);
    process.exit(1);
  }

  const auth = getAdminAuth(credentials);
  const db = getAdminFirestore(credentials);

  let user;
  if (uidArg) {
    user = await auth.getUser(uidArg);
  } else {
    try {
      user = await auth.getUserByEmail(email);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        console.error(
          `No Auth user for ${email}. Ask them to sign up first, or run bootstrap with --password.`,
        );
        process.exit(1);
      }
      throw error;
    }
  }

  const now = new Date();
  const userRef = db.collection("users").doc(user.uid);
  const existing = await userRef.get();
  const previousRole = existing.exists ? existing.data()?.role : undefined;

  await userRef.set(
    {
      uid: user.uid,
      email: user.email || email || undefined,
      displayName:
        displayName ||
        user.displayName ||
        (existing.exists ? existing.data()?.displayName : undefined) ||
        user.email?.split("@")[0] ||
        "User",
      display_name:
        displayName ||
        user.displayName ||
        (existing.exists ? existing.data()?.display_name : undefined) ||
        user.email?.split("@")[0] ||
        "User",
      role,
      status: "active",
      active: true,
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now, created_time: now }),
    },
    { merge: true },
  );

  await db.collection("auditLogs").add({
    actorId: "script:admin:set-role",
    actorEmail: "system",
    action: "user.role_change",
    resourceType: "user",
    resourceId: user.uid,
    previousValue: { role: previousRole ?? null },
    newValue: { role },
    createdAt: now,
  });

  console.log(
    `Updated ${user.email || user.uid}: ${previousRole ?? "(none)"} → ${role}`,
  );
  if (role === "customer") {
    console.log("Admin access removed. User can still shop as a customer.");
  } else {
    console.log("User can sign in and open /admin (nav filtered by role).");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
