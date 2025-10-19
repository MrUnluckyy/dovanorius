import React from "react";
import { PublishBoard } from "./PublishBoard";

type Board = {
  id: string;
  name: string;
  description: string;
  created_at: string;
};

type Props = {
  board: Board;
};

export function BoardBar({ board }: Props) {
  return (
    <div className="flex gap-4 justify-between">
      <div className="flex gap-12">
        <div className="avatar">
          <div className="w-30 rounded-full">
            <img
              src="https://img.daisyui.com/images/profile/demo/yellingcat@192.webp"
              alt="Board cover"
            />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-4xl font-semibold mb-2">{board.name}</h2>
            <p className="text-sm">{board.description}</p>
          </div>
        </div>
      </div>
      <div>
        <PublishBoard boardId={board.id} boardName={board.name} />
        <button className="btn">Share</button>
      </div>
    </div>
  );
}
