import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const projectId = "zenvexa-c8d84";
const email = (process.env.ZENVEXA_INITIAL_ADMIN_EMAIL ?? "test@admin.com").trim().toLowerCase();
const allowExisting = process.env.ZENVEXA_ALLOW_EXISTING_ADMIN === "true";

if (!email || !/^\S+@\S+\.\S+$/.test(email))
  throw new Error("Set ZENVEXA_INITIAL_ADMIN_EMAIL to a valid email address.");

const app = initializeApp({ projectId }, "initial-admin-provisioning");
const auth = getAuth(app);
const db = getFirestore(app);
let user = null;
let createdAuthUser = false;
try {
  user = await auth.getUserByEmail(email);
} catch (error) {
  if (error?.code !== "auth/user-not-found") throw error;
}
if (user && !allowExisting) {
  console.log(
    JSON.stringify(
      {
        status: "existing-auth-user",
        projectId,
        email,
        uid: user.uid,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        staffRecord: (await db.doc(`staff/${user.uid}`).get()).exists,
        action:
          "No password or role was changed. Re-run with ZENVEXA_ALLOW_EXISTING_ADMIN=true only after reviewing this account.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 2;
} else {
  if (!user) {
    const password = process.env.ZENVEXA_INITIAL_ADMIN_PASSWORD;
    if (!password || password.length < 6)
      throw new Error(
        "Set ZENVEXA_INITIAL_ADMIN_PASSWORD in the environment; do not pass it as an argument.",
      );
    user = await auth.createUser({ email, password, emailVerified: true, disabled: false });
    createdAuthUser = true;
  }
  try {
    const result = await db.runTransaction(async (tx) => {
      const ref = db.doc(`staff/${user.uid}`);
      const existing = await tx.get(ref);
      if (existing.exists) {
        const data = existing.data();
        return {
          status: "existing-staff-record",
          role: data.role,
          active: data.active,
          changed: false,
        };
      }
      tx.create(ref, {
        role: "admin",
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        provisionedBy: "initial-admin-script",
      });
      return { status: "staff-record-created", role: "admin", active: true, changed: true };
    });
    console.log(
      JSON.stringify(
        {
          status: result.status,
          projectId,
          email,
          uid: user.uid,
          emailVerified: user.emailVerified,
          disabled: user.disabled,
          staff: { role: result.role, active: result.active, changed: result.changed },
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (createdAuthUser) await auth.deleteUser(user.uid);
    throw error;
  }
}
await deleteApp(app);
