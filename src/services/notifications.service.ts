import {
  deleteDoc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/firebase/firestore";
import {
  notificationDoc,
  notificationsCollection,
} from "@/firebase/collections";
import type { AppNotification } from "@/types/commerce";

export async function listNotificationsByUser(
  userId: string,
): Promise<AppNotification[]> {
  const snapshot = await getDocs(
    query(notificationsCollection(), where("userId", "==", userId)),
  );
  return snapshot.docs
    .map((document) => document.data())
    .sort((a, b) => {
      const aTime =
        a.createdAt instanceof Date
          ? a.createdAt.getTime()
          : typeof a.createdAt === "string"
            ? Date.parse(a.createdAt)
            : 0;
      const bTime =
        b.createdAt instanceof Date
          ? b.createdAt.getTime()
          : typeof b.createdAt === "string"
            ? Date.parse(b.createdAt)
            : 0;
      return bTime - aTime;
    });
}

export async function getNotification(
  id: string,
): Promise<AppNotification | undefined> {
  const snapshot = await getDoc(notificationDoc(id));
  return snapshot.exists() ? snapshot.data() : undefined;
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(notificationDoc(id), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const items = await listNotificationsByUser(userId);
  const unread = items.filter((item) => !item.read);
  if (!unread.length) return;
  const batch = writeBatch(getDb());
  for (const item of unread) {
    batch.update(notificationDoc(item.id), { read: true });
  }
  await batch.commit();
}

export async function deleteNotification(id: string): Promise<void> {
  await deleteDoc(notificationDoc(id));
}
