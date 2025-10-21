"use client";
import React, { useState } from "react";
import { PublishBoard } from "./PublishBoard";

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
};

export function BoardBar({ board, inPublicView }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!board.is_public) return;
    const url = `${window.location.origin}/board/${board.slug}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
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
              {board.name}
              <span className="badge badge-info ml-2">
                {board.is_public ? "Public" : "Personal"}
              </span>
            </h2>
            <p className="text-sm">{board.description}</p>
          </div>
        </div>
      </div>
      {inPublicView ? null : (
        <div className="flex flex-col gap-2">
          <PublishBoard
            boardId={board.id}
            boardName={board.name}
            boardPublished={board.is_public}
          />
          <button
            className={`btn ${copied ? "btn-success" : ""}`}
            onClick={handleCopy}
            disabled={!board.is_public}
          >
            {copied ? "Board copied" : "Share Board"}
          </button>
        </div>
      )}
    </div>
  );
}
