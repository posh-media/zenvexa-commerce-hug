"use client";

import { useState } from "react";
import { uploadAdminImage, type MediaFolder } from "@/services/media.service";

export function MultiImageUploadField({
  label,
  folder,
  value,
  onChange,
  idHint = "image",
}: {
  label: string;
  folder: MediaFolder;
  value: string[];
  onChange: (urls: string[]) => void;
  idHint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <label className="mb-2 block text-[13px] font-medium text-ink">
        {label}
      </label>
      {value.length ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-20 w-20 rounded-xl border border-line object-cover"
              />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-[11px] text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        disabled={uploading}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (!files.length) return;
          setUploading(true);
          setError(null);
          void (async () => {
            const urls: string[] = [];
            for (const file of files) {
              urls.push(await uploadAdminImage(folder, file, idHint));
            }
            return urls;
          })()
            .then((urls) => onChange([...value, ...urls]))
            .catch((err) =>
              setError(
                err instanceof Error ? err.message : "Upload failed.",
              ),
            )
            .finally(() => {
              setUploading(false);
              event.target.value = "";
            });
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
