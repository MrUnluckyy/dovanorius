import { createClient } from "@/utils/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Item } from "./WishList";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useEffect, useMemo, useState } from "react";
import { ItemFormValues, ItemSchema } from "@/schemas/ItemSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProductImageUpload } from "@/hooks/useImageUpload";
import imageCompression from "browser-image-compression";

export function ItemForm({
  item,
  onCloseModal,
  onCancel,
}: {
  item: Item;
  onCloseModal: () => void;
  onCancel: () => void;
}) {
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const supabase = createClient();
  const queryClient = useQueryClient();
  const { uploadProductImage } = useProductImageUpload();

  const t = useTranslations("Boards");

  const defaultValues: ItemFormValues = {
    title: item.title || "",
    url: item.url || "",
    notes: item.notes || "",
    image_url: item.image_url || "",
    price: item.price || undefined,
    boardId: item.board_id || "",
  };

  const { register, handleSubmit, reset, formState, getValues, watch } =
    useForm<ItemFormValues>({
      defaultValues,
      resolver: zodResolver(ItemSchema),
      mode: "onSubmit",
    });

  const currentImage = useMemo(
    () => previewUrl || watch("image_url") || "/assets/placeholder.jpg",
    [previewUrl, watch]
  );

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

  const onSubmit = async (data: ItemFormValues) => {
    try {
      // Optional: basic client-side file guard
      if (uploadedImageFile) {
        if (uploadedImageFile.size > 10 * 1024 * 1024) {
          toast.error(t("imageTooLarge", { size: "5MB" }));
          return;
        }
        if (!/^image\/(png|jpe?g|webp)$/i.test(uploadedImageFile.type)) {
          toast.error(t("imageTypeInvalid"));
          return;
        }
      }
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      };

      // 1) If a new image is chosen, upload to Supabase Storage (public bucket example).
      let image_url = data.image_url || null;
      if (uploadedImageFile) {
        const compressedFile = await imageCompression(
          uploadedImageFile,
          options
        );
        image_url = await uploadProductImage(compressedFile, item.id);
      }

      // 2) Update the row
      const { error: updateErr } = await supabase
        .from("items")
        .update({
          title: data.title,
          board_id: data.boardId,
          url: data.url || null,
          notes: data.notes || null,
          image_url,
          price: data.price ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateErr) throw updateErr;

      // 3) Invalidate relevant caches
      // Adjust these keys to match how you query (e.g., ["items", board_id], ["item", id])
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

  useEffect(() => {
    if (!uploadedImageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(uploadedImageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadedImageFile]);

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
                // allow empty field
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

          <div>
            {formState ? (
              <img
                src={currentImage}
                alt={getValues("title")}
                className="max-w-[300px] mx-auto"
              />
            ) : null}
          </div>

          <label className="label">{t("image")}</label>
          <input
            type="file"
            className="file-input w-full"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) =>
              setUploadedImageFile(e.target.files ? e.target.files[0] : null)
            }
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
