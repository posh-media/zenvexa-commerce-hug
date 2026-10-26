import {
  addDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { notificationsCollection, usersCollection } from "@/firebase/collections";
import { writeAuditLog } from "@/services/audit.service";
import type { AppNotification, NotificationDocument } from "@/types/commerce";

type Actor = { id: string; email?: string };

export async function listAllNotificationsAdmin(): Promise<AppNotification[]> {
  const snapshot = await getDocs(notificationsCollection());
  return snapshot.docs.map((d) => d.data());
}

export async function createNotificationAdmin(
  input: Omit<NotificationDocument, "createdAt" | "updatedAt" | "read">,
  actor: Actor,
) {
  const payload: NotificationDocument = {
    ...input,
    read: false,
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };
  const ref = await addDoc(notificationsCollection(), payload);
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "notification.create",
    resourceType: "notification",
    resourceId: ref.id,
    newValue: { userId: input.userId, title: input.title },
  });
  return ref.id;
}

/**
 * Fan-out notification to all users (architecture — sequential writes).
 * Prefer Cloud Functions for large audiences in production.
 */
export async function broadcastNotificationAdmin(
  input: {
    title: string;
    message: string;
    type?: string;
    href?: string;
  },
  actor: Actor,
) {
  const users = await getDocs(usersCollection());
  let created = 0;
  for (const user of users.docs) {
    await createNotificationAdmin(
      {
        userId: user.id,
        title: input.title,
        message: input.message,
        type: input.type ?? "promo",
        href: input.href,
      },
      actor,
    );
    created += 1;
  }
  await writeAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "notification.broadcast",
    resourceType: "notification",
    newValue: { title: input.title, recipients: created },
  });
  return created;
}
