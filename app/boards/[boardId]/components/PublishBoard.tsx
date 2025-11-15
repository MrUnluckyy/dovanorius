"use client";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { LuLock, LuLockOpen } from "react-icons/lu";
import { generateSlug } from "@/utils/helpers/slugify";

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
  const t = useTranslations("Boards");

  async function onPublish(e: React.FormEvent) {
    const slug = boardSlug ? boardSlug : generateSlug(boardName);

    e.preventDefault();
    const { error } = await supabase
      .from("boards")
      .update({ slug, is_public: !boardPublished })
      .eq("id", boardId);
    if (!error) qc.invalidateQueries({ queryKey: ["board", boardId] });
  }

  return (
    <form onSubmit={onPublish} className="w-full">
      <button className="btn w-full whitespace-nowrap" type="submit">
        {boardPublished ? <LuLock /> : <LuLockOpen />}
        {boardPublished ? t("makePrivate") : t("publish")}
      </button>
    </form>
  );
}
