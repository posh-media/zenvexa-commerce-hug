import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/firebase/firestore";
import { addressDoc, addressesCollection } from "@/firebase/collections";
import type { Address, AddressDocument } from "@/types/address";
import { stripUndefined } from "@/utils/firestore";

export async function listAddressesByUser(userId: string): Promise<Address[]> {
  const snapshot = await getDocs(
    query(addressesCollection(), where("userId", "==", userId)),
  );
  return snapshot.docs.map((document) => document.data());
}

export async function getAddress(id: string): Promise<Address | undefined> {
  const snapshot = await getDoc(addressDoc(id));
  return snapshot.exists() ? snapshot.data() : undefined;
}

export async function createAddress(data: AddressDocument): Promise<string> {
  const payload = stripUndefined({
    ...data,
    recipientName: data.recipientName?.trim() ?? "",
    phone: data.phone?.trim() ?? "",
    country: data.country?.trim() ?? "",
    state: data.state?.trim() ?? "",
    city: data.city?.trim() ?? "",
    addressLine: data.addressLine?.trim() ?? "",
    postalCode: data.postalCode?.trim() ?? "",
    landmark: data.landmark?.trim() ?? "",
    id: "",
  });
  const ref = await addDoc(addressesCollection(), payload as Address);
  if (data.default) {
    await setDefaultAddress(data.userId, ref.id);
  }
  return ref.id;
}

export async function updateAddress(
  id: string,
  data: Partial<AddressDocument>,
): Promise<void> {
  await updateDoc(addressDoc(id), stripUndefined(data));
  if (data.default && data.userId) {
    await setDefaultAddress(data.userId, id);
  }
}

export async function deleteAddress(id: string): Promise<void> {
  await deleteDoc(addressDoc(id));
}

/** Ensure only one default address per user. */
export async function setDefaultAddress(
  userId: string,
  addressId: string,
): Promise<void> {
  const addresses = await listAddressesByUser(userId);
  const batch = writeBatch(getDb());
  for (const address of addresses) {
    batch.update(addressDoc(address.id), {
      default: address.id === addressId,
    });
  }
  await batch.commit();
}
