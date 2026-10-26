import {
  addDoc,
  collection,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { COLLECTIONS } from "@/constants/collections";
import { getDb } from "@/firebase/firestore";
import type { AuditLog, AuditLogDocument } from "@/types/admin";
import { stripUndefined } from "@/utils/firestore";

function auditCollection() {
  return collection(getDb(), COLLECTIONS.auditLogs);
}

export async function writeAuditLog(input: {
  actorId: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  meta?: Record<string, unknown>;
}) {
  const document: AuditLogDocument = {
    actorId: input.actorId,
    actorEmail: input.actorEmail ?? "",
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? "",
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    meta: input.meta ?? {},
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };
  await addDoc(auditCollection(), stripUndefined(document));
}

export async function listAuditLogs(max = 100): Promise<AuditLog[]> {
  const snapshot = await getDocs(
    query(auditCollection(), orderBy("createdAt", "desc"), limitTo(max)),
  );
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as AuditLogDocument),
  }));
}
