"use client";
import React, { useState } from "react";
import { PublishBoard } from "./PublishBoard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { UserLoadingSkeleton } from "@/components/loaders/UserLoadingSkeleton";
import { AddMemberModal } from "./AddMemberModal";
import { useBoardMembersMap } from "@/hooks/useMemberMap";
import { AvatarGroup } from "../../components/AvatarGroup";
import { LuShare, LuTrash } from "react-icons/lu";
import { useConfirm } from "@/components/ConfirmDialogProvider";

type Board = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  created_at: string;
  is_public: boolean;
};

type Props = {
  board: Board;
  inPublicView?: boolean;
  userId?: string | null;
};

export function BoardBar({ board, inPublicView, userId }: Props) {
  const [copied, setCopied] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("Boards");
  const confirm = useConfirm();

  const handleCopy = async () => {
    if (!boardClient?.is_public) return;
    const url = `${window.location.origin}/users/${userId}/${board.slug}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const { data: boardClient, isLoading } = useQuery({
    queryKey: ["board", board.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("id, name, description, created_at, is_public, slug")
        .eq("id", board?.id)
        .single();
      if (error) throw error;
      return data as Board;
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
      message: t("confirmDeleteMessage", { title: boardClient?.name || "" }),
      confirmText: t("confirmDeleteButton"),
    });

    if (!ok) return;

    deleteBoard.mutate();
  };
  const { membersByBoard } = useBoardMembersMap([board.id]);

  if (isLoading) return <UserLoadingSkeleton />;

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-12 w-full">
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-4xl font-semibold mb-2">
              {boardClient?.name}
              <span className="badge badge-info ml-2">
                {boardClient?.is_public ? t("public") : t("private")}
              </span>
            </h2>
            <p className="text-sm">{boardClient?.description}</p>
          </div>
          <div>
            {membersByBoard[board.id]?.length > 1 && (
              <AvatarGroup members={membersByBoard[board.id] || []} />
            )}
          </div>
        </div>
      </div>
      {inPublicView ? null : (
        <div className="flex flex-col gap-2 ">
          <PublishBoard
            boardId={boardClient?.id || ""}
            boardName={boardClient?.name || ""}
            boardPublished={boardClient?.is_public || false}
            boardSlug={boardClient?.slug}
          />
          <button
            className={`whitespace-nowrap btn ${copied ? "btn-success" : ""} `}
            onClick={handleCopy}
            disabled={!boardClient?.is_public}
          >
            <LuShare /> {copied ? t("copied") : t("share")}
          </button>
          {userId && <AddMemberModal userId={userId} boardId={board.id} />}
          <button
            className="btn btn-ghost whitespace-nowrap"
            onClick={handleDelete}
          >
            <LuTrash />
            {t("delete")}
          </button>
        </div>
      )}
    </div>
  );
}
