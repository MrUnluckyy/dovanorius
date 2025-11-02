"use client";
import React from "react";
import { Item } from "./WishList";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { LuExternalLink } from "react-icons/lu";

type Props = {
  item: Item;
  boardId: string;
  inPublicBoard?: boolean;
  user?: User | null;
};

export function WishListItem({ item, boardId, inPublicBoard, user }: Props) {
  const { title, url, notes, price } = item;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["items", boardId] }),
  });

  return (
    <div key={item.id} className="card bg-base-200 shadow-sm max-w-md">
      <figure className="w-full">
        {item.image_url ? (
          <img src={item.image_url} alt={title} />
        ) : (
          <img src="/assets/placeholder.jpg" alt="Gift illustration" />
        )}
      </figure>
      <div className="card-body">
        {price && <p className="text-xl font-bold ">&euro; {price}</p>}
        <h2 className="card-title">{title}</h2>
        <p>{notes}</p>

        <div className="card-actions flex-col w-full">
          {inPublicBoard && user && (
            <button className="btn btn-primary w-full">Reserve</button>
          )}

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary w-full"
            >
              View Item <LuExternalLink />
            </a>
          )}
          {!inPublicBoard && (
            <>
              <button
                className="btn btn-primary w-full"
                onClick={() => deleteItem.mutate(item.id)}
              >
                Edit
              </button>
              <button
                className="btn btn-error w-full"
                onClick={() => deleteItem.mutate(item.id)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
