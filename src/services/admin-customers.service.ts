import {
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { userDoc, usersCollection } from "@/firebase/collections";
import { listOrdersAdmin } from "@/services/admin-orders.service";
import { writeAuditLog } from "@/services/audit.service";
import type { UserProfile } from "@/types/user";
import { USER_ROLES, type UserRole, type UserStatus } from "@/constants/app";
import { stripUndefined } from "@/utils/firestore";

type Actor = { id: string; email?: string };

export type AdminCustomerRow = UserProfile & {
  orderCount: number;
  totalSpent: number;
};

export async function listCustomersAdmin(): Promise<AdminCustomerRow[]> {
  const [usersSnap, orders] = await Promise.all([
    getDocs(usersCollection()),
    listOrdersAdmin(),
  ]);

  const spendByUser = new Map<string, { count: number; total: number }>();
  for (const order of orders) {
    const uid = order.userId;
    if (!uid || uid.startsWith("guest_")) continue;
    const entry = spendByUser.get(uid) ?? { count: 0, total: 0 };
    entry.count += 1;
    if (order.paymentStatus === "paid" || order.orderStatus === "delivered") {
      entry.total += Number(order.total ?? 0);
    }
    spendByUser.set(uid, entry);
  }

  return usersSnap.docs.map((document) => {
    const profile = document.data();
    const stats = spendByUser.get(profile.id) ?? { count: 0, total: 0 };
    return {
      ...profile,
      orderCount: stats.count,
      totalSpent: stats.total,
    };
  });
}

export async function setCustomerStatusAdmin(
  userId: string,
  status: UserStatus,
  actor: Actor,
) {
  await updateDoc(
    userDoc(userId),
    stripUndefined({
      status,
      active: status === "active",
      updatedAt: serverTimestamp(),
    }),
  );
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: status === "suspended" ? "customer.suspend" : "customer.reactivate",
    resourceType: "user",
    resourceId: userId,
    newValue: { status },
  });
}

/** Promote / demote staff. Requires caller to be super_admin or admin (Firestore rules). */
export async function setUserRoleAdmin(
  userId: string,
  role: UserRole,
  actor: Actor,
) {
  if (userId === actor.id && role === "customer") {
    throw new Error("You cannot remove your own admin access from this screen.");
  }

  const allowed: readonly string[] = USER_ROLES;
  if (!allowed.includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  const snap = await getDoc(userDoc(userId));
  const previousRole = snap.exists() ? snap.data()?.role : undefined;

  await updateDoc(
    userDoc(userId),
    stripUndefined({
      role,
      updatedAt: serverTimestamp(),
    }),
  );

  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "user.role_change",
    resourceType: "user",
    resourceId: userId,
    previousValue: { role: previousRole ?? null },
    newValue: { role },
  });
}
