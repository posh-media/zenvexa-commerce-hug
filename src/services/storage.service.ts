import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/firebase/storage";

export function storageRef(path: string) {
  return ref(getFirebaseStorage(), path);
}

export async function uploadFile(path: string, file: Blob) {
  const result = await uploadBytes(storageRef(path), file);
  return getDownloadURL(result.ref);
}

export function getFileUrl(path: string) {
  return getDownloadURL(storageRef(path));
}
