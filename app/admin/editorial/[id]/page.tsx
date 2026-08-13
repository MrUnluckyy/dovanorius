import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { loadPicks } from "../_lib/health";
import { summarise, scheduleState, type EditorialShelf } from "../_lib/types";
import { ShelfEditorClient } from "./_components/ShelfEditorClient";

export const dynamic = "force-dynamic";

export default async function EditorialShelfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data } = await supabaseAdmin
    .from("gift_personas")
    .select(
      "id, slug, label_lt, label_en, description, is_active, sort_order, starts_at, ends_at, created_at, kind"
    )
    .eq("id", id)
    .maybeSingle();

  // Anything that is not an editorial shelf is not editable here — the LLM
  // curator owns recipient and theme shelves, and hand-picking one would be
  // overwritten on Monday.
  if (!data || data.kind !== "editorial") notFound();

  const shelf = data as EditorialShelf;
  const picks = (await loadPicks([shelf.id])).get(shelf.id) ?? [];

  return (
    <ShelfEditorClient
      shelf={shelf}
      picks={picks}
      health={summarise(picks)}
      schedule={scheduleState(shelf)}
    />
  );
}
