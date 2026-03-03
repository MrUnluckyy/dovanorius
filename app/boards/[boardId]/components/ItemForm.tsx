import { createClient } from "@/utils/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Item } from "./WishList";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import { ItemFormValues, ItemSchema } from "@/schemas/ItemSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProductImageUpload } from "@/hooks/useImageUpload";
import imageCompression from "browser-image-compression";
import { ImageUploadGrid, ImageSlot } from "@/components/ui/ImageUploadGrid";

export function ItemForm({
  item,
  onCloseModal,
  onCancel,
}: {
  item: Item;
  onCloseModal: () => void;
  onCancel: () => void;
}) {
  // Existing images already stored in the DB
  const [existingUrls, setExistingUrls] = useState<string[]>(
    item.image_urls?.length
      ? item.image_urls
      : item.image_url
      ? [item.image_url]
      : []
  );
  // New files the user picks in this edit session
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newFilePreviewUrls, setNewFilePreviewUrls] = useState<string[]>([]);

  const supabase = createClient();
  const queryClient = useQueryClient();
  const { uploadMultipleProductImages } = useProductImageUpload();

  const t = useTranslations("Boards");

  const defaultValues: ItemFormValues = {
    title: item.title || "",
    url: item.url || "",
    notes: item.notes || "",
    image_url: item.image_url || "",
    price: item.price || undefined,
    boardId: item.board_id || "",
  };

  const { register, handleSubmit, reset, formState } =
    useForm<ItemFormValues>({
      defaultValues,
      resolver: zodResolver(ItemSchema),
      mode: "onSubmit",
    });

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("my_boards_with_stats")
        .select("*")
        .order("last_item_added_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Maintain object URLs for new-file previews
  useEffect(() => {
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setNewFilePreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [newFiles]);

  const slots: ImageSlot[] = [
    ...existingUrls.map((url) => ({ url, isNew: false })),
    ...newFilePreviewUrls.map((url) => ({ url, isNew: true })),
  ];

  const handleAdd = (file: File) => {
    if (slots.length >= 5) return;
    setNewFiles((prev) => [...prev, file]);
  };

  const handleRemove = (index: number) => {
    if (index < existingUrls.length) {
      setExistingUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      const fileIndex = index - existingUrls.length;
      setNewFiles((prev) => prev.filter((_, i) => i !== fileIndex));
    }
  };

  const onSubmit = async (data: ItemFormValues) => {
    try {
      const compressionOptions = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      };

      let uploadedUrls: string[] = [];
      if (newFiles.length > 0) {
        const compressed = await Promise.all(
          newFiles.map((f) => imageCompression(f, compressionOptions))
        );
        uploadedUrls = await uploadMultipleProductImages(compressed, item.id);
      }

      const finalUrls = [...existingUrls, ...uploadedUrls].slice(0, 5);

      const { error: updateErr } = await supabase
        .from("items")
        .update({
          title: data.title,
          board_id: data.boardId,
          url: data.url || null,
          notes: data.notes || null,
          image_url: finalUrls[0] ?? null,
          image_urls: finalUrls,
          price: data.price ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateErr) throw updateErr;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        item.board_id
          ? queryClient.invalidateQueries({
              queryKey: ["items", item.board_id],
            })
          : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["item", item.id] }),
      ]);

      toast.success(t("edited", { item: data.title }));
      onCloseModal();
      reset(defaultValues);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
        return;
      }
      if (typeof err === "string") {
        toast.error(err);
        return;
      }

      toast.error(t("somethingWentWrong"));
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <h3 className="font-bold text-lg">{t("addWish")}</h3>
        <fieldset className="fieldset w-full max-h-[60vh] overflow-y-auto">
          <label className="label">{t("selectBoard")}</label>
          <select
            defaultValue="Pick a color"
            className="select w-full"
            disabled={isLoading}
            {...register("boardId")}
          >
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>

          <label className="label">{t("url")}</label>
          <input
            type="url"
            className="input w-full"
            placeholder={"www..."}
            {...register("url")}
          />
          {formState.errors.url ? (
            <p className="text-sm text-error mt-1">
              {formState.errors.url.message}
            </p>
          ) : null}

          <label className="label">{t("title")}</label>
          <input
            type="text"
            className="input w-full"
            placeholder={t("title")}
            {...register("title")}
          />
          {formState.errors.title ? (
            <p className="text-sm text-error mt-1">
              {formState.errors.title.message}
            </p>
          ) : null}

          <label className="label">{t("price")}</label>
          <input
            type="number"
            className="input w-full"
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
          {formState.errors.notes ? (
            <p className="text-sm text-error mt-1">
              {formState.errors.notes.message}
            </p>
          ) : null}

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
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              reset(defaultValues);
              onCancel();
            }}
          >
            {t("ctaCancel")}
          </button>
          <button className="btn btn-primary" type="submit">
            {t("ctaSubmit")}
          </button>
        </div>
      </form>
    </div>
  );
}
