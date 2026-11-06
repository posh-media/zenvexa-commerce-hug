import { hasPermission } from "@/lib/admin/rbac";
import { getAdminApp, getAdminDb } from "@/lib/server/firebase-admin";
import { getAuth } from "firebase-admin/auth";
export async function requestIdentity(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("Authentication required.");
  return getAuth(getAdminApp()).verifyIdToken(token, true);
}
export async function requireOrderActor(
  request: Request,
  order: { userId?: string },
  staffOnly = false,
) {
  const identity = await requestIdentity(request);
  const profile = (
    await getAdminDb().collection("users").doc(identity.uid).get()
  ).data();
  const staff = hasPermission(
    profile?.role,
    staffOnly ? "orders:write" : "orders:read",
  );
  if (
    profile?.active === false ||
    profile?.status === "suspended" ||
    profile?.status === "deleted" ||
    (!staff && (staffOnly || order.userId !== identity.uid))
  )
    throw new Error("Access denied.");
  return identity;
}
