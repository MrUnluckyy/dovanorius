"use client";
import React, { useState } from "react";
import { PublishBoard } from "./PublishBoard";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

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

  const handleCopy = async () => {
    if (!board.is_public) return;
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

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-12">
        <div className="avatar avatar-placeholder">
          <div className="bg-accent text-neutral-content w-24 rounded-full">
            <span className="text-3xl">🎁</span>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-4xl font-semibold mb-2">
              {boardClient?.name}
              <span className="badge badge-info ml-2">
                {boardClient?.is_public ? "Public" : "Personal"}
              </span>
            </h2>
            <p className="text-sm">{boardClient?.description}</p>
          </div>
        </div>
      </div>
      {inPublicView ? null : (
        <div className="flex flex-col gap-2">
          <PublishBoard
            boardId={boardClient?.id || ""}
            boardName={boardClient?.name || ""}
            boardPublished={boardClient?.is_public || false}
            boardSlug={boardClient?.slug}
          />
          <button
            className={`btn ${copied ? "btn-success" : ""}`}
            onClick={handleCopy}
            disabled={!boardClient?.is_public}
          >
            {copied ? "Board copied" : "Share Board"}
          </button>
        </div>
      )}
    </div>
  );
}
