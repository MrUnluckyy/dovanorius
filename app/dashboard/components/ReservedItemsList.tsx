"use client";
import { useTranslations } from "next-intl";
import { ReservedItem } from "./ReservedItem";
import { ReservedWishlistItem } from "./ReservedItems";

export function ReservedItemsList({
  items,
}: {
  items: ReservedWishlistItem[];
}) {
  const t = useTranslations("Boards");

  return (
    <div>
      {items.length === 0 ? (
        <div className="flex flex-col justify-center items-center">
          <p className="text-center">{t("noItems")}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {items.map((item) => (
          <ReservedItem key={item.id} boardId={item.board_id} item={item} />
        ))}
      </div>
    </div>
  );
}
