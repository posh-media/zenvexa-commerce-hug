import { uploadFile } from "@/services/storage.service";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 5 * 1024 * 1024;

export type MediaFolder =
  | "products"
  | "brands"
  | "categories"
  | "banners"
  | "misc";

export function validateImageFile(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      ok: false as const,
      reason: "Use JPEG, PNG, WebP or GIF images only.",
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false as const,
      reason: "Image must be 5MB or smaller.",
    };
  }
  return { ok: true as const };
}

/** Upload an image to Firebase Storage under an admin media folder. */
export async function uploadAdminImage(
  folder: MediaFolder,
  file: File,
  idHint = "asset",
) {
  const check = validateImageFile(file);
  if (!check.ok) throw new Error(check.reason);

  const ext =
    file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "jpg";
  const path = `admin/${folder}/${idHint}-${Date.now()}.${ext}`;
  return uploadFile(path, file);
}
