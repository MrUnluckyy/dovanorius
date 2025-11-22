"use client";
import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { LuClipboardPen, LuTrash2, LuX } from "react-icons/lu";
import { Board } from "./BoardBar";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmDialogProvider";

type FormData = {
  name: string;
  description: string;
  isPrivate: boolean;
};

export function EditBoard({ userId, board }: { userId: string; board: Board }) {
  const [isOpen, setIsOpen] = useState(false);

  const supabase = createClient();
  const queryClient = useQueryClient();
  const t = useTranslations("Boards");
  const router = useRouter();
  const confirm = useConfirm();

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      name: board.name || "",
      description: board.description || "",
      isPrivate: !board.is_public,
    },
  });

  const openModal = () => {
    setIsOpen(true);
  };
  const closeModal = () => {
    setIsOpen(false);
  };

  const updateBoard = useMutation({
    mutationFn: async ({ name, description, isPrivate }: FormData) => {
      const { error } = await supabase
        .from("boards")
        .update({ owner_id: userId, is_public: !isPrivate, name, description })
        .eq("id", board.id)
        .single();
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      reset(variables);
      toast.success(t("edited", { item: variables.name }));
      queryClient.invalidateQueries({ queryKey: ["board", board.id] });
    },
  });

  const deleteBoard = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("boards")
        .delete()
        .eq("id", board.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      router.push("/boards");
    },
  });

  const handleDelete = async () => {
    const ok = await confirm({
      title: t("confirmDeleteTitle"),
      message: t("confirmDeleteMessage", { title: board?.name || "" }),
      confirmText: t("confirmDeleteButton"),
    });

    if (!ok) return;

    deleteBoard.mutate();
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      updateBoard.mutate(data, {
        onSuccess: () => {
          closeModal();
        },
      });
    } catch (error) {
      toast.error(t("toastBoardUpdateError"));
    }
  };

  useEffect(() => {
    reset({
      name: board.name || "",
      description: board.description || "",
      isPrivate: !board.is_public,
    });
  }, [board, reset]);

  return (
    <div className="w-full justify-end">
      <button
        className="btn whitespace-nowrap w-full md:w-auto"
        onClick={openModal}
      >
        <LuClipboardPen />
        {t("ctaEditBoard")}
      </button>
      {isOpen && (
        <dialog open={isOpen} className="modal">
          <div className="modal-box">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={closeModal}
              about="Uždaryti modalą"
            >
              <LuX className="text-lg" />
            </button>
            <h3 className="font-bold text-lg">{t("editBoardTitle")}</h3>
            <form onSubmit={handleSubmit(onSubmit)}>
              <fieldset className="fieldset w-full mt-6">
                <div className="flex justify-between ">
                  <label className="text-lg">{t("isPrivate")}</label>
                  <label className="toggle text-base-content">
                    <input
                      id="makePublic"
                      type="checkbox"
                      {...register("isPrivate")}
                    />
                    <svg
                      aria-label="disabled"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                    <svg
                      aria-label="enabled"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                    >
                      <g
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeWidth="4"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path d="M20 6 9 17l-5-5"></path>
                      </g>
                    </svg>
                  </label>
                </div>
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

              <div className="modal-action flex-row-reverse justify-between">
                <button className="btn btn-primary" type="submit">
                  {t("ctaSave")}
                </button>
                <button
                  type="button"
                  className="btn btn-error whitespace-nowrap"
                  onClick={handleDelete}
                >
                  <LuTrash2 />
                  {t("delete")}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={closeModal}>
            <button>{t("ctaClose")}</button>
          </div>
        </dialog>
      )}
    </div>
  );
}
