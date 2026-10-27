// components/BoardForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { createClient } from "@/utils/supabase/client";
import { newBoardCode } from "@/utils/helpers/slugify";
import { reportError } from "@/lib/report";
import { LuGlobe, LuLock } from "react-icons/lu";

type BoardFormValues = {
  name: string;
  description: string;
  isPrivate: boolean;
};

type BoardFormProps = {
  onCancel: () => void;
  /** Gets the new board, e.g. to open it straight away. */
  onSuccess?: (board: { id: string; name: string }) => void;
};

/**
 * The one form for creating a board — the create menu and the boards page both
 * render it, so neither can drift (the boards page copy had lost the privacy
 * choice, and every board made there came out public).
 */
export function BoardForm({ onCancel, onSuccess }: BoardFormProps) {
  const t = useTranslations("Boards");
  const supabase = createClient();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<BoardFormValues>({
    defaultValues: {
      name: "",
      description: "",
      isPrivate: false,
    },
  });

  const isPrivate = watch("isPrivate");

  const createBoard = useMutation({
    mutationFn: async ({ name, description, isPrivate }: BoardFormValues) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("boards")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          description: description.trim(),
          is_public: !isPrivate,
          slug: newBoardCode(),
        })
        .select("id, name")
        .single();

      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: (board) => {
      toast.success(t("toastBoardCreated", { board: board.name }));
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      reset();
      onSuccess?.(board);
    },
    onError: (error) => {
      reportError({
        area: "board",
        reason: "create_failed",
        detail: { message: String(error) },
      });
      toast.error(t("toastBoardCreateError"));
    },
  });

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <form
      onSubmit={handleSubmit((data) => createBoard.mutate(data))}
      className="space-y-4"
    >
      <fieldset className="fieldset w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        <div>
          <label className="label mb-1" htmlFor="board-name">
            <span className="font-semibold text-base-content">{t("boardTitle")}</span>
          </label>
          <input
            id="board-name"
            type="text"
            autoFocus
            maxLength={60}
            className="input w-full"
            placeholder={t("boardTitlePlaceholder") || ""}
            {...register("name", {
              required: true,
              validate: (v) => v.trim().length > 0,
            })}
          />
          {errors.name && (
            <p className="text-sm text-error mt-1">{t("boardTitleError")}</p>
          )}
        </div>

        <div>
          <label className="label mb-1" htmlFor="board-description">
            <span className="font-semibold text-base-content">
              {t("boardDescription")}
            </span>
          </label>
          <textarea
            id="board-description"
            rows={2}
            className="textarea w-full"
            placeholder={t("boardDescriptionPlaceholder") || ""}
            {...register("description")}
          />
        </div>

        {/* Who can see it — the one decision that matters before sharing. */}
        <label
          htmlFor="board-private"
          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition ${
            isPrivate
              ? "border-(--nr-yellow-deep) bg-(--nr-tile)"
              : "border-(--nr-border) bg-(--nr-surface)"
          }`}
        >
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              isPrivate
                ? "bg-(--nr-ink) text-white"
                : "bg-(--nr-tile) text-(--nr-gold-strong)"
            }`}
            aria-hidden
          >
            {isPrivate ? <LuLock className="w-4" /> : <LuGlobe className="w-4" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col whitespace-normal">
            <span className="text-sm font-semibold text-base-content">
              {t("privateBoardLabel")}
            </span>
            <span className="text-sm text-(--nr-muted)">
              {isPrivate ? t("privateBoardHintOn") : t("privateBoardHintOff")}
            </span>
          </span>
          <input
            id="board-private"
            type="checkbox"
            className="toggle mt-1 shrink-0"
            {...register("isPrivate")}
          />
        </label>
      </fieldset>

      <div className="modal-action mt-2">
        <button type="button" className="btn btn-ghost" onClick={handleCancel}>
          {t("ctaClose")}
        </button>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={createBoard.isPending}
          data-busy={createBoard.isPending || undefined}
        >
          {createBoard.isPending ? t("ctaSaving") : t("ctaCreateBoard")}
        </button>
      </div>
    </form>
  );
}
