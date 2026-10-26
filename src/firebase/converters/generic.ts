import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  WithFieldValue,
} from "firebase/firestore";
import { stripUndefined } from "@/utils/firestore";

/**
 * Converter for collections whose document shape maps 1:1 to `T`, with the
 * Firestore id exposed as `id`.
 */
export function createConverter<TDocument extends DocumentData>(): FirestoreDataConverter<
  TDocument & { id: string },
  TDocument
> {
  return {
    toFirestore(model: WithFieldValue<TDocument & { id: string }>) {
      const data = { ...(model as Record<string, unknown>) };
      delete data.id;
      return stripUndefined(data) as TDocument;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot<TDocument>) {
      return { ...snapshot.data(), id: snapshot.id };
    },
  };
}
