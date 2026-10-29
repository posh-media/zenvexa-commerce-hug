import { COLLECTIONS } from "@/constants/collections";
import { getDb } from "@/firebase/firestore";
import { deploymentStoreId } from "@/lib/store";
import { storeDocuments } from "@/lib/store-queries";
import type { AuditLog, AuditLogDocument } from "@/types/admin";
import { stripUndefined } from "@/utils/firestore";
import {
  addDoc,
  collection,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

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
    storeId: deploymentStoreId(),
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
  const documents = await storeDocuments(auditCollection(), [
    orderBy("createdAt", "desc"),
  ]);
  return documents.slice(0, max).map((doc) => ({
    id: doc.id,
    ...(doc.data() as AuditLogDocument),
  }));
}
