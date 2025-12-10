// components/BoardForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { createClient } from "@/utils/supabase/client";
import { generateSlug } from "@/utils/helpers/slugify";
import { LuCheck, LuX } from "react-icons/lu";

type BoardFormValues = {
  name: string;
  description: string;
  isPrivate: boolean;
};

type BoardFormProps = {
  onCancel: () => void;
  onSuccess?: () => void;
};

export function BoardForm({ onCancel, onSuccess }: BoardFormProps) {
  const t = useTranslations("Boards");
  const supabase = createClient();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<BoardFormValues>({
    defaultValues: {
      name: "",
      description: "",
      isPrivate: false,
    },
  });

  const createBoard = useMutation({
    mutationFn: async ({ name, description, isPrivate }: BoardFormValues) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("boards").insert({
        owner_id: user.id,
        name,
        description,
        is_public: !isPrivate,
        slug: generateSlug(name),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      const boardName = getValues("name");
      toast.success(t("toastBoardCreated", { board: boardName }));
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      reset();
      onSuccess?.();
    },
    onError: () => {
      toast.error(t("toastBoardCreateError"));
    },
  });

  const onSubmit = (data: BoardFormValues) => {
    createBoard.mutate(data);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <fieldset className="fieldset w-full space-y-3">
        <div>
          <label className="label">
            <span className="label-text">{t("boardTitle")}</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder={t("boardTitlePlaceholder") || ""}
            {...register("name", { required: true })}
          />
          {errors.name && (
            <p className="text-sm text-error mt-1">
              {t("boardTitleError") || "Pavadinimas yra privalomas"}
            </p>
          )}
        </div>

        <div>
          <label className="label">
            <span className="label-text">{t("boardDescription")}</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            placeholder={t("boardDescriptionPlaceholder") || ""}
            {...register("description")}
          />
        </div>

        <div className="flex justify-between ">
          <label htmlFor="makePublic" className="text-lg">
            {t("isPrivate")}
          </label>
          <label className="toggle text-base-content">
            <input id="makePublic" type="checkbox" {...register("isPrivate")} />
            <LuX className="w-4 h-4" />
            <LuCheck className="w-4 h-4" />
          </label>
        </div>
      </fieldset>

      <div className="modal-action mt-4">
        <button type="button" className="btn btn-ghost" onClick={handleCancel}>
          {t("ctaClose")}
        </button>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={createBoard.isPending}
        >
          {createBoard.isPending
            ? t("ctaSaving") ?? "Saugoma..."
            : t("ctaSave")}
        </button>
      </div>
    </form>
  );
}
