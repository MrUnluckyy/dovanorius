"use client";

import { useRef, useState } from "react";
import { LuPlus, LuX } from "react-icons/lu";
import { prepareImageForUpload } from "@/utils/images/prepareImage";

export type ImageSlot = { url: string; isNew: boolean };

type Props = {
  slots: ImageSlot[];
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
  maxImages?: number;
};

export function ImageUploadGrid({
  slots,
  onAdd,
  onRemove,
  maxImages = 5,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset immediately so the same file can be re-selected after removal.
    e.target.value = "";
    if (!file) return;
    // Convert iPhone HEIC → JPEG (and compress) up front, so the preview
    // thumbnail renders instead of appearing broken in Chrome/Firefox.
    setProcessing(true);
    try {
      const prepared = await prepareImageForUpload(file);
      onAdd(prepared);
    } catch {
      onAdd(file);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot, i) => (
        <div
          key={slot.url}
          className="relative w-20 h-20 rounded-md overflow-hidden border border-base-300"
        >
          <img
            src={slot.url}
            alt={`Image ${i + 1}`}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-0.5 right-0.5 btn btn-circle btn-xs btn-error opacity-90"
            aria-label="Remove image"
          >
            <LuX className="text-xs" />
          </button>
        </div>
      ))}

      {slots.length < maxImages && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
            className="w-20 h-20 flex items-center justify-center rounded-md border-2 border-dashed border-base-300 hover:border-primary transition-colors text-base-content/50 hover:text-primary disabled:opacity-60"
            aria-label="Add image"
          >
            {processing ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <LuPlus className="text-2xl" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
            className="hidden"
            onChange={handleFileChange}
          />
        </>
      )}
    </div>
  );
}
