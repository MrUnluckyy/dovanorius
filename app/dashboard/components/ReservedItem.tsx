"use client";
import React from "react";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { Item } from "@/app/boards/[boardId]/components/WishList";
import PriceCategoryBadge from "@/app/boards/[boardId]/components/PriceCategoryBadge";
import { ViewItemModal } from "@/app/boards/[boardId]/components/ViewItemModal";
import { ViewReservedItem } from "./ViewReservedItem";

type Props = {
  item: Item;
  boardId: string;
  inPublicBoard?: boolean;
  user?: User | null;
};

export function ReservedItem({ item, inPublicBoard, user }: Props) {
  const { title, price, status, reserved_by } = item;
  const t = useTranslations("Boards");

  return (
    <div className="card bg-base-200 shadow-sm">
      <figure className="px-10 pt-10">
        <div
          className="aspect-square w-32 overflow-hidden rounded-md relative"
          aria-hidden={!item?.image_url} // image is decorative if there's no real image
        >
          <img
            src={item?.image_url || "/assets/placeholder.jpg"}
            alt={title ?? "Gift image"} // meaningful alt
            className="h-full w-full object-cover object-center"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = "/assets/placeholder.jpg";
            }}
          />
        </div>

        {inPublicBoard && status === "reserved" && reserved_by ? (
          <div className="badge badge-sm badge-warning absolute top-2 left-2">
            {reserved_by === user?.id ? t("myReservation") : t("reserved")}
          </div>
        ) : (
          <PriceCategoryBadge price={price} />
        )}
      </figure>
      <div className="card-body items-center text-center p-4 justify-between">
        <h2 className="card-title text-md text-sm line-clamp-2">{title}</h2>
        <div className="card-actions">
          <ViewReservedItem
            item={item}
            inPublicBoard={inPublicBoard}
            user={user}
          />
        </div>
      </div>
    </div>
  );
}
