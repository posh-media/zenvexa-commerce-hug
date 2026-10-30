import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { loadCredentials, parseArgs } from "./lib/admin.mjs";
import { provisionSuperAdmin } from "./lib/super-admin-bootstrap.mjs";

const { option } = parseArgs();
const account = loadCredentials(option("credentials"));
if (option("project") !== "shop-day84j" || account.project_id !== "shop-day84j") {
  throw new Error("Explicit --project=shop-day84j and matching credentials are required.");
}
initializeApp({ projectId: "shop-day84j", credential: cert(account) });
const result = await provisionSuperAdmin(getAuth(), getFirestore(), "superadmin@zenvexa.com");
console.log(JSON.stringify({ project: "shop-day84j", ...result, next: "Use Forgot password to set up access through the account email inbox." }));
