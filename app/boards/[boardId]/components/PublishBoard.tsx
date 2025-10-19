// Example button/form inside your board row (owner only UI)
"use client";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { v4 as uuidv4 } from "uuid";

export function PublishBoard({
  boardId,
  boardName,
}: {
  boardId: string;
  boardName: string;
}) {
  const supabase = createClient();
  const qc = useQueryClient();

  async function onPublish(e: React.FormEvent) {
    const slug =
      boardName.toLocaleLowerCase().replace(/\s+/g, "-") +
      "-" +
      uuidv4().slice(0, 8);

    e.preventDefault();
    const { error } = await supabase
      .from("boards")
      .update({ slug, is_public: true })
      .eq("id", boardId);
    if (!error) qc.invalidateQueries(); // refresh lists
  }

  return (
    <form onSubmit={onPublish} className="flex gap-2">
      <button className="btn btn-active" type="submit">
        Make public
      </button>
    </form>
  );
}
