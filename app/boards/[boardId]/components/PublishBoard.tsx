"use client";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { v4 as uuidv4 } from "uuid";

export function PublishBoard({
  boardId,
  boardName,
  boardPublished,
  boardSlug,
}: {
  boardId: string;
  boardName: string;
  boardPublished: boolean;
  boardSlug?: string | null;
}) {
  const supabase = createClient();
  const qc = useQueryClient();

  async function onPublish(e: React.FormEvent) {
    const slug = boardSlug
      ? boardSlug
      : boardName.toLocaleLowerCase().replace(/\s+/g, "-") +
        "-" +
        uuidv4().slice(0, 8);

    e.preventDefault();
    const { error } = await supabase
      .from("boards")
      .update({ slug, is_public: !boardPublished })
      .eq("id", boardId);
    if (!error) qc.invalidateQueries({ queryKey: ["board", boardId] });
  }

  return (
    <form onSubmit={onPublish} className="flex gap-2 w-full">
      <button className="btn w-full" type="submit">
        {boardPublished ? "Make Private" : "Publish"}
      </button>
    </form>
  );
}
