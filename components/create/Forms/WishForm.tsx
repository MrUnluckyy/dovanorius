"use client";
import ProductUrlParser from "@/components/ProductUrlParser";
import { useProductImageUpload } from "@/hooks/useImageUpload";
import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ItemFormValues, ItemSchema } from "@/schemas/ItemSchema";
import toast from "react-hot-toast";
import { stripHtml } from "@/utils/helpers/stripHtml";
import { useEffect, useState } from "react";
import { useCurrentBoardId } from "@/hooks/useCurrentBoardId";
import { useBoards } from "@/hooks/useBoards";
import { ImageUploadGrid, ImageSlot } from "@/components/ui/ImageUploadGrid";
import imageCompression from "browser-image-compression";

type WishFormProps = {
  onCancel: () => void;
  onSuccess?: () => void;
};

export function WishForm({ onCancel, onSuccess }: WishFormProps) {
  const t = useTranslations("Boards");
  const supabase = createClient();
  const queryClient = useQueryClient();
  const currentBoardId = useCurrentBoardId();
  const { uploadMultipleProductImages } = useProductImageUpload();
  const { data: boards = [], isLoading: boardsLoading } = useBoards();

  const [parsing, setParsing] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const defaultValues: ItemFormValues = {
    title: "",
    url: "",
    notes: "",
    image_url: "",
    price: undefined,
    boardId: currentBoardId || "",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState,
    getValues,
    setValue,
    watch,
  } = useForm<ItemFormValues>({
    defaultValues,
    resolver: zodResolver(ItemSchema),
    mode: "onSubmit",
  });

  const parsedImageUrl = watch("image_url");

  // Build slots: parsed image (if any) + pending file previews
  const slots: ImageSlot[] = [
    ...(parsedImageUrl ? [{ url: parsedImageUrl, isNew: false }] : []),
    ...previewUrls.map((url) => ({ url, isNew: true })),
  ];

  // Manage object URLs for preview
  useEffect(() => {
    const urls = pendingFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingFiles]);

  const handleAdd = (file: File) => {
    if (slots.length >= 5) return;
    setPendingFiles((prev) => [...prev, file]);
  };

  const handleRemove = (index: number) => {
    // The first slot may be the parsed image_url
    const parsedOffset = parsedImageUrl ? 1 : 0;
    if (index < parsedOffset) {
      // Remove parsed image_url
      setValue("image_url", "");
    } else {
      const fileIndex = index - parsedOffset;
      setPendingFiles((prev) => prev.filter((_, i) => i !== fileIndex));
    }
  };

  const handleParse = async () => {
    const url = getValues("url");
    if (!url) return;
    setParsing(true);

    try {
      const res = await fetch(`/api/parser?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        throw new Error("Failed to fetch parsed data");
      }
      const data = await res.json();

      if (data?.title) setValue("title", data.title);
      if (data?.description) setValue("notes", stripHtml(data.description));
      if (data?.images && data.images.length > 0) {
        setValue("image_url", data.images[0]);
      }
      if (data?.price) {
        setValue("price", Number(data.price.replace(",", ".")));
      }
    } catch (err) {
      toast.error(
        "😭 Duomenų nepavyko gauti. Likusią informaciją suveskite patys."
      );
    } finally {
      setParsing(false);
    }
  };

  const addItem = useMutation({
    mutationFn: async (payload: ItemFormValues) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("items")
        .insert({
          board_id: payload.boardId,
          title: payload.title,
          url: payload.url || null,
          image_url: payload.image_url || null,
          notes: payload.notes || null,
          created_by: user.id,
          price: payload.price || null,
          status: "wanted",
          priority: "medium",
        })
        .select()
        .single();

      if (error) throw error;

      const compressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      };

      // Upload pending files
      let uploadedUrls: string[] = [];
      if (pendingFiles.length > 0) {
        const compressed = await Promise.all(
          pendingFiles.map((f) => imageCompression(f, compressionOptions))
        );
        uploadedUrls = await uploadMultipleProductImages(compressed, data.id);
      }

      // Build final image_urls: parsed URL first, then uploaded
      const parsedUrl = payload.image_url || null;
      const finalUrls = [
        ...(parsedUrl ? [parsedUrl] : []),
        ...uploadedUrls,
      ].slice(0, 5);

      if (finalUrls.length > 0) {
        const { error: updateError } = await supabase
          .from("items")
          .update({
            image_urls: finalUrls,
            image_url: finalUrls[0],
          })
          .eq("id", data.id);

        if (updateError) {
          console.error("Error updating item with image URLs:", updateError);
        }
      }
    },
    onSuccess: () => {
      toast.success(t("toastItemAdded", { item: getValues("title") }));
      queryClient.invalidateQueries({ queryKey: ["items"] });
      reset();
      setPendingFiles([]);
      onSuccess?.();
    },
  });

  const onSubmit = (data: ItemFormValues) => {
    addItem.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset className="fieldset w-full space-y-3">
        <ProductUrlParser
          onParse={handleParse}
          loading={parsing}
          register={register}
        />

        <div className="flex flex-col">
          <label className="label">
            <span className="label-text">{t("board")}</span>
          </label>

          {boards.length === 0 ? (
            <p className="text-sm text-base-content/70">
              Neturi lentų. Pirmiausia sukurk lentą.
            </p>
          ) : (
            <select
              disabled={boardsLoading}
              className="select w-full"
              {...register("boardId")}
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="label">
            <span className="label-text">{t("title")}</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder={t("title")}
            {...register("title")}
          />
          {formState.errors.title && (
            <p className="text-sm text-error mt-1">
              {formState.errors.title.message}
            </p>
          )}
        </div>

        <div>
          <label className="label">
            <span className="label-text">{t("price")}</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            inputMode="decimal"
            step="0.01"
            placeholder={t("price")}
            {...register("price", {
              setValueAs: (value) => {
                if (value === "" || value === null || value === undefined) {
                  return undefined;
                }
                const n = Number(value);
                return Number.isNaN(n) ? undefined : n;
              },
            })}
          />
          {formState.errors.price && (
            <p className="text-sm text-error mt-1">
              {formState.errors.price.message}
            </p>
          )}
        </div>

        <div>
          <label className="label">
            <span className="label-text">{t("notes")}</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            placeholder={t("notes")}
            {...register("notes")}
          />
          {formState.errors.notes && (
            <p className="text-sm text-error mt-1">
              {formState.errors.notes.message}
            </p>
          )}
        </div>

        <div>
          <label className="label">
            <span className="label-text">{t("image")}</span>
          </label>
          <ImageUploadGrid
            slots={slots}
            onAdd={handleAdd}
            onRemove={handleRemove}
            maxImages={5}
          />
          <label className="label">
            <span className="label-text-alt">{t("maxImageSizeLabel")}</span>
          </label>
        </div>
      </fieldset>

      <div className="modal-action mt-4">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            reset();
            setPendingFiles([]);
            onCancel();
          }}
        >
          {t("ctaClose")}
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={addItem.isPending}
        >
          {addItem.isPending
            ? t("ctaSubmitting") ?? "Saving..."
            : t("ctaSubmit")}
        </button>
      </div>
    </form>
  );
}
