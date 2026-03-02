"use client";

import { useRef } from "react";
import { LuPlus, LuX } from "react-icons/lu";

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAdd(file);
      // Reset so the same file can be re-selected after removal
      e.target.value = "";
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
            className="w-20 h-20 flex items-center justify-center rounded-md border-2 border-dashed border-base-300 hover:border-primary transition-colors text-base-content/50 hover:text-primary"
            aria-label="Add image"
          >
            <LuPlus className="text-2xl" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </>
      )}
    </div>
  );
}
