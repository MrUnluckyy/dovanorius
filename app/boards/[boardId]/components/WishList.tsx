"use client";
import { useQuery } from "@tanstack/react-query";
import { WishListItem } from "./WishListItem";
import { AddItemModal } from "./AddItemModal";
import { createClient } from "@/utils/supabase/client";

export type Item = {
  id: string;
  title: string;
  notes: string | null;
  url: string | null;
  status: "wanted" | "reserved" | "purchased";
  priority: "low" | "medium" | "high";
  created_at: string;
};

export function WishList({ boardId }: { boardId: string }) {
  const supabase = createClient();

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["items", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id, title, notes, url, status, priority, created_at")
        .eq("board_id", boardId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Item[];
    },
  });

  if (isLoading)
    return <span className="loading loading-bars loading-xl"></span>;
  if (error) return <p className="text-red-600">Failed to load items</p>;

  return (
    <div className="overflow-x-auto">
      <div className="w-full flex justify-end">
        <AddItemModal boardId={boardId} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th></th>
            <th>Title</th>
            <th>Price</th>
            <th>Url</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <WishListItem key={item.id} boardId={boardId} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
