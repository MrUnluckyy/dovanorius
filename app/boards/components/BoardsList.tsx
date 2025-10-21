"use client";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import React from "react";
import { CreateWishlist } from "../[boardId]/components/CreateWishlist";

export function BoardsList({ user }: { user: User }) {
  const supabase = createClient();
  const userId = user.id;

  const { data: boards = [], isLoading } = useQuery({
    queryKey: ["boards", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boards")
        .select("id, name, description, created_at")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p>Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <CreateWishlist user={user} />
      <div className="flex flex-col md:flex-row gap-4">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/boards/${board.id}`}
            className="cursor-pointer flex-1 max-w-md"
          >
            <div key={board.id} className="card bg-base-300 card-sm shadow-sm ">
              <div className="card-body">
                <h2 className="card-title">{board.name}</h2>
                <p className="h-14">{board.description}</p>
                <div className="justify-end card-actions">
                  <button className="btn btn-accent">View</button>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
