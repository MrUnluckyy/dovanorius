"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { UserLoadingSkeleton } from "@/components/loaders/UserLoadingSkeleton";
import { AddMemberModal } from "./AddMemberModal";
import { useBoardMembersMap } from "@/hooks/useMemberMap";
import { AvatarGroup } from "../../components/AvatarGroup";
import { EditBoard } from "./EditBoard";
import { ShareModal } from "./ShareModal";

export type Board = {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  created_at: string;
  is_public: boolean;
  share_token?: string | null;
};

type Props = {
  boardId: string;
  inPublicView?: boolean;
  userId?: string | null;
};

export function BoardBar({ boardId, inPublicView, userId }: Props) {
  const supabase = createClient();
  const t = useTranslations("Boards");

  const { data: boardClient, isLoading } = useQuery({
    queryKey: ["board", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("id, name, description, created_at, is_public, slug, share_token")
        .eq("id", boardId)
        .single();
      if (error) throw error;
      return data as Board;
    },
  });

  const { membersByBoard } = useBoardMembersMap([boardId]);

  if (isLoading) return <UserLoadingSkeleton />;

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex flex-col gap-6 md:flex-row items-start md:gap-12 w-full">
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-4xl font-semibold mb-2 font-heading">
              {boardClient?.name}
              {!boardClient?.is_public && (
                <span className="badge badge-info ml-2">{t("private")}</span>
              )}
            </h2>
            <p className="text-sm">{boardClient?.description}</p>
          </div>
          <div>
            {membersByBoard[boardId]?.length > 1 && (
              <AvatarGroup members={membersByBoard[boardId] || []} />
            )}
          </div>
        </div>
      </div>
      {inPublicView ? null : (
        <div className="flex flex-col gap-2">
          {boardClient && <ShareModal board={boardClient} />}
          {userId && boardClient && (
            <>
              <EditBoard board={boardClient} userId={userId} />
              <AddMemberModal userId={userId} boardId={boardId} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
