"use client";
import React from "react";
import { Item } from "./WishList";
import { User } from "@supabase/supabase-js";
import { ViewItemModal } from "./ViewItemModal";
import PriceCategoryBadge from "./PriceCategoryBadge";
import { useTranslations } from "next-intl";

type Props = {
  item: Item;
  boardId: string;
  inPublicBoard?: boolean;
  user?: User | null;
};

export function WishListItem({ item, inPublicBoard, user }: Props) {
  const { title, price, status, reserved_by } = item;
  const t = useTranslations("Boards");

  const isMine = reserved_by === user?.id;
  // Reserved by someone else → hide the gift: blur image + strip metadata.
  const isBlocked =
    !!inPublicBoard && status === "reserved" && !!reserved_by && !isMine;

  const displayTitle = isBlocked ? t("reservedWish") : title;

  return (
    <div className={`card bg-base-200 shadow-sm ${isBlocked ? "opacity-70" : ""}`}>
      <figure className="px-10 pt-10">
        <div
          className="aspect-square w-32 overflow-hidden rounded-md relative"
          aria-hidden={!item?.image_url && !item?.image_urls?.length}
        >
          <img
            src={item?.image_urls?.[0] ?? item?.image_url ?? "/assets/placeholder.jpg"}
            alt={isBlocked ? t("reservedWish") : title ?? "Gift image"}
            className={`h-full w-full object-cover object-center transition ${
              isBlocked ? "blur-xl scale-125" : ""
            }`}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = "/assets/placeholder.jpg";
            }}
            data-clarity-mask="true"
          />
          {isBlocked && (
            <div className="absolute inset-0 bg-base-100/30" aria-hidden />
          )}
          {!isBlocked && (item?.image_urls?.length ?? 0) > 1 && (
            <span className="absolute bottom-1 right-1 badge badge-xs badge-neutral opacity-90">
              +{item.image_urls.length - 1}
            </span>
          )}
        </div>

        {inPublicBoard && status === "reserved" && reserved_by ? (
          <div
            className="badge badge-sm badge-warning absolute top-2 left-2"
            data-clarity-mask="true"
          >
            {isMine ? t("myReservation") : t("reserved")}
          </div>
        ) : (
          <PriceCategoryBadge price={price} />
        )}
      </figure>
      <div className="card-body items-center text-center p-4 justify-between">
        <h2
          className="card-title text-md text-sm line-clamp-2"
          data-clarity-mask="true"
        >
          {displayTitle}
        </h2>
        <div className="card-actions">
          <ViewItemModal
            item={item}
            inPublicBoard={inPublicBoard}
            user={user}
          />
        </div>
      </div>
    </div>
  );
}
