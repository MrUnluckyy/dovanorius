"use client";
import { useQuery } from "@tanstack/react-query";
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
    <div className="">
      <div className="w-full flex justify-end mb-4">
        <AddItemModal boardId={boardId} />
      </div>

      <div className="flex">
        {(items ?? []).map((item) => (
          <div key={item.id} className="card bg-base-200 shadow-sm max-w-md">
            <figure className="max-h-52">
              <img
                src="https://images.unsplash.com/photo-1640025867572-f6b3a8410c81?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1364"
                alt="Gift illustration"
              />
            </figure>
            <div className="card-body">
              <h2 className="card-title">{item.title}</h2>
              <p>{item.notes}</p>
              <div className="card-actions justify-end">
                <button className="btn btn-primary">Reserve</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
