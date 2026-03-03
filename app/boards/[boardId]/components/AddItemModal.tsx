"use client";
import ProductUrlParser from "@/components/ProductUrlParser";
import { useProductImageUpload } from "@/hooks/useImageUpload";
import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ItemFormValues, ItemSchema } from "@/schemas/ItemSchema";
import toast from "react-hot-toast";
import { stripHtml } from "@/utils/helpers/stripHtml";
import { LuX } from "react-icons/lu";
import { ImageUploadGrid, ImageSlot } from "@/components/ui/ImageUploadGrid";
import imageCompression from "browser-image-compression";

export function AddItemModal({
  boardId,
  children,
}: {
  boardId: string;
  children: React.ReactNode;
}) {
  const [parsing, setParsing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const { uploadMultipleProductImages } = useProductImageUpload();
  const t = useTranslations("Boards");

  const defaultValues: ItemFormValues = {
    title: "",
    url: "",
    notes: "",
    image_url: "",
    price: undefined,
    boardId: boardId,
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

  const supabase = createClient();
  const queryClient = useQueryClient();

  const openModal = () => {
    setIsOpen(true);
  };
  const closeModal = () => {
    reset();
    setPendingFiles([]);
    setIsOpen(false);
  };

  // Manage object URLs for new file previews
  useEffect(() => {
    const urls = pendingFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingFiles]);

  // Combined slots: parsed image (if any) + new file previews
  const slots: ImageSlot[] = [
    ...(parsedImageUrl ? [{ url: parsedImageUrl, isNew: false }] : []),
    ...previewUrls.map((url) => ({ url, isNew: true })),
  ];

  const handleAdd = (file: File) => {
    if (slots.length >= 5) return;
    setPendingFiles((prev) => [...prev, file]);
  };

  const handleRemove = (index: number) => {
    const parsedOffset = parsedImageUrl ? 1 : 0;
    if (index < parsedOffset) {
      setValue("image_url", "");
    } else {
      const fileIndex = index - parsedOffset;
      setPendingFiles((prev) => prev.filter((_, i) => i !== fileIndex));
    }
  };

  const handleParse = async () => {
    if (!getValues("url")) return;
    setParsing(true);
    try {
      const res = await fetch(
        `/api/parser?url=${encodeURIComponent(getValues("url") || "")}`
      );
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
        setValue("price", Number(data?.price.replace(",", ".")));
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
          board_id: boardId,
          title: payload.title,
          url: payload.url || null,
          image_url: payload.image_url || null,
          notes: payload?.notes || null,
          created_by: user?.id || null,
          price: payload?.price || null,
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

      let uploadedUrls: string[] = [];
      if (pendingFiles.length > 0) {
        const compressed = await Promise.all(
          pendingFiles.map((f) => imageCompression(f, compressionOptions))
        );
        uploadedUrls = await uploadMultipleProductImages(compressed, data.id);
      }

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
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      reset();
      setPendingFiles([]);
      closeModal();
    },
  });

  const onSubmit = async (data: ItemFormValues) => {
    addItem.mutate(data);
  };

  return (
    <>
      <button className="btn btn-primary" onClick={openModal}>
        {children}
      </button>
      {isOpen && (
        <dialog open={isOpen} className="modal">
          <div className="modal-box">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={closeModal}
              aria-label={t("ctaClose")}
            >
              <LuX className="text-lg" />
            </button>
            <form onSubmit={handleSubmit(onSubmit)}>
              <h3 className="font-bold text-lg">{t("addWish")}</h3>
              <fieldset className="fieldset w-full">
                <ProductUrlParser
                  onParse={handleParse}
                  loading={parsing}
                  register={register}
                />
                <label className="label">{t("title")}</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder={t("title")}
                  {...register("title")}
                />

                <label className="label">{t("price")}</label>
                <input
                  type="number"
                  className="input w-full"
                  inputMode="decimal"
                  step="0.01"
                  placeholder={t("price")}
                  {...register("price", {
                    setValueAs: (value) => {
                      if (
                        value === "" ||
                        value === null ||
                        value === undefined
                      ) {
                        return undefined;
                      }
                      const n = Number(value);
                      return Number.isNaN(n) ? undefined : n;
                    },
                  })}
                />
                {formState.errors.price ? (
                  <p className="text-sm text-error mt-1">
                    {formState.errors.price.message}
                  </p>
                ) : null}

                <label className="label">{t("notes")}</label>
                <textarea
                  className="textarea w-full"
                  placeholder={t("notes")}
                  {...register("notes")}
                />

                <label className="label">{t("image")}</label>
                <ImageUploadGrid
                  slots={slots}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  maxImages={5}
                />
                <label className="label">{t("maxImageSizeLabel")}</label>
              </fieldset>
              <div className="modal-action">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={addItem.isPending}
                >
                  {addItem.isPending
                    ? t("ctaSubmitting") ?? "Saving..."
                    : t("ctaSubmit")}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={closeModal}>
            <button>{t("ctaClose")}</button>
          </div>
        </dialog>
      )}
    </>
  );
}
