"use client";
import ProductUrlParser from "@/components/ProductUrlParser";
import { useProductImageUpload } from "@/hooks/useImageUpload";
import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, useRef, useMemo } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { ItemFormValues } from "./ItemForm";
import { zodResolver } from "@hookform/resolvers/zod";
import { ItemSchema } from "@/schemas/ItemSchema";

export function AddItemModal({
  boardId,
  children,
}: {
  boardId: string;
  children: React.ReactNode;
}) {
  const [parsing, setParsing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const { uploadProductImage } = useProductImageUpload();
  const t = useTranslations("Boards");

  const defaultValues: ItemFormValues = {
    title: "",
    url: "",
    notes: "",
    image_url: "",
    price: undefined,
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

  const modalRef = useRef<HTMLDialogElement>(null);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const openModal = () => {
    setIsOpen(true);
    modalRef.current?.showModal();
  };
  const closeModal = () => {
    setIsOpen(false);
    modalRef.current?.close();
  };

  const handleParse = async () => {
    if (!getValues("url")) return;
    setParsing(true);
    try {
      const res = await fetch(
        `/api/parser?url=${encodeURIComponent(getValues("url") || "")}`
      );
      const data = await res.json();

      if (data?.title) {
        setValue("title", data.title);
      }
      if (data?.description) {
        setValue("notes", data.description);
      }
      if (data?.images && data.images.length > 0) {
        setValue("image_url", data.images[0]);
      }
      if (data?.price) {
        setValue("price", Number(data.price));
      }
    } catch (err) {
      console.error("Error parsing product:", err);
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

      if (uploadedImageFile) {
        const imageUrl = await uploadProductImage(uploadedImageFile, data?.id);
        if (imageUrl) {
          const { error } = await supabase
            .from("items")
            .update({ image_url: imageUrl })
            .eq("id", data.id)
            .select()
            .single();
          if (error) {
            console.error("Error updating item with image URL:", error);
          }
        }
      }
    },
    onSuccess: (data) => {
      reset();
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      closeModal();
    },
  });

  const onSubmit: SubmitHandler<ItemFormValues> = async (data) => {
    addItem.mutate(data);
  };

  return (
    <>
      <button className="btn btn-accent" onClick={openModal}>
        {children}
      </button>
      <dialog ref={modalRef} open={isOpen} className="modal">
        <div className="modal-box">
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
                placeholder={t("price")}
                {...register("price", { valueAsNumber: true })}
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

              <div>
                {getValues("image_url") ? (
                  <img src={getValues("image_url")} alt={getValues("title")} />
                ) : null}
              </div>

              <label className="label">{t("image")}</label>
              <input
                type="file"
                className="file-input w-full"
                onChange={(e) =>
                  setUploadedImageFile(
                    e.target.files ? e.target.files[0] : null
                  )
                }
              />
              <label className="label">{t("maxImageSizeLabel")}</label>
            </fieldset>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={closeModal}>
                {t("ctaClose")}
              </button>
              <button className="btn btn-primary" type="submit">
                {t("ctaSubmit")}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
