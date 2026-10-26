"use client";

import { useState } from "react";
import { uploadAdminImage, type MediaFolder } from "@/services/media.service";

export function ImageUploadField({
  label,
  folder,
  value,
  onChange,
  idHint = "image",
}: {
  label: string;
  folder: MediaFolder;
  value?: string;
  onChange: (url: string) => void;
  idHint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <label className="mb-2 block text-[13px] font-medium text-ink">
        {label}
      </label>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="mb-3 h-24 w-24 rounded-xl border border-line object-cover"
        />
      ) : null}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setUploading(true);
          setError(null);
          void uploadAdminImage(folder, file, idHint)
            .then((url) => onChange(url))
            .catch((err) =>
              setError(
                err instanceof Error ? err.message : "Upload failed.",
              ),
            )
            .finally(() => setUploading(false));
        }}
        className="block w-full text-[13px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-soft file:px-4 file:py-2 file:text-[13px] file:font-medium file:text-ink"
      />
      {uploading ? (
        <p className="mt-1 text-[12px] text-muted">Uploading…</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[12px] text-primary" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
