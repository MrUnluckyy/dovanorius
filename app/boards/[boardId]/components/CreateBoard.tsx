"use client";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FormEvent, useRef, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { LuClipboardPlus } from "react-icons/lu";

type FormData = {
  name: string;
  description: string;
};

export function CreateBoard({ user }: { user: User | null }) {
  const [isOpen, setIsOpen] = useState(false);

  const supabase = createClient();
  const modalRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const t = useTranslations("Boards");

  const { register, handleSubmit, reset, getValues } = useForm({
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const openModal = () => {
    setIsOpen(true);
    modalRef.current?.showModal();
  };
  const closeModal = () => {
    setIsOpen(false);
    modalRef.current?.close();
  };

  const createBoard = useMutation({
    mutationFn: async ({ name, description }: FormData) => {
      const { error } = await supabase
        .from("boards")
        .insert({ owner_id: user?.id, name, description });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("toastBoardCreated", { board: getValues("name") }));
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      reset();
    },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      createBoard.mutate(data);
    } catch (error) {
      toast.error(t("toastBoardCreateError"));
    } finally {
      closeModal();
    }
  };

  return (
    <div className="w-full justify-end">
      <button className="btn" onClick={openModal}>
        <LuClipboardPlus />
        {t("ctaCreateBoard")}
      </button>
      <dialog ref={modalRef} open={isOpen} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">{t("createBoardTitle")}</h3>
          <form onSubmit={handleSubmit(onSubmit)}>
            <fieldset className="fieldset w-full">
              <label className="label">{t("boardTitle")}</label>
              <input
                type="text"
                className="input w-full"
                placeholder={t("boardTitlePlaceholder") || ""}
                required
                {...register("name")}
              />

              <label className="label">{t("boardDescription")}</label>
              <textarea
                className="textarea w-full"
                placeholder={t("boardDescriptionPlaceholder") || ""}
                {...register("description")}
              />
            </fieldset>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
              >
                {t("ctaCancel")}
              </button>
              <button className="btn btn-primary" type="submit">
                {t("ctaSave")}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}
