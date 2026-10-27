import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

type ItemStatus = "wanted" | "reserved" | "purchased";

export function ItemActions({
  boardId,
  itemId,
}: {
  boardId: string;
  itemId: string;
}) {
  const supabase = createClient();
  const qc = useQueryClient();

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items", boardId] }),
  });

  const setStatus = useMutation({
    mutationFn: async (status: "wanted" | "reserved" | "purchased") => {
      const { error } = await supabase
        .from("items")
        .update({ status })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items", boardId] }),
  });

  // To be looked at later
  // async function onPublish(e: React.FormEvent) {
  //   e.preventDefault();
  //   const { error } = await supabase
  //     .from("boards")
  //     .update({ is_public: true })
  //     .eq("id", boardId);
  //   if (!error) qc.invalidateQueries(); // refresh lists
  // }

  return (
    <div className="flex gap-2 shrink-0">
      <select
        className="border rounded px-2 py-1 text-sm"
        onChange={(e) => setStatus.mutate(e.target.value as ItemStatus)}
        defaultValue="wanted"
      >
        <option value="wanted">Wanted</option>
        <option value="reserved">Reserved</option>
        <option value="purchased">Purchased</option>
      </select>
      <button
        className="text-red-600 text-sm underline"
        onClick={() => del.mutate()}
      >
        Delete
      </button>
    </div>
  );
}
