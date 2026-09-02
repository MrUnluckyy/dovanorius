"use client";
import { useState } from "react";
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
  // Publishing had no pending state at all, so a second click while the first
  // update was in flight toggled visibility straight back.
  const [busy, setBusy] = useState(false);

  async function onPublish(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const slug = boardSlug ? boardSlug : generateSlug(boardName);

    setBusy(true);
    try {
      const { error } = await supabase
        .from("boards")
        .update({ slug, is_public: !boardPublished })
        .eq("id", boardId);
      if (!error) qc.invalidateQueries({ queryKey: ["board", boardId] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onPublish} className="w-full">
      <button
        className="btn w-full whitespace-nowrap"
        type="submit"
        disabled={busy}
        data-busy={busy || undefined}
      >
        {boardPublished ? <LuLock /> : <LuLockOpen />}
        {boardPublished ? t("makePrivate") : t("publish")}
      </button>
    </form>
  );
}
