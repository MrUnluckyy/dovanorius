"use client";
import { useTranslations } from "next-intl";
import { ReservedItem } from "./ReservedItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReservedWishlistItem } from "./ReservedItems";

export function ReservedItemsList({
  items,
}: {
  items: ReservedWishlistItem[];
}) {
  const t = useTranslations("Dashboard");

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState
          compact
          hero="hourglass"
          title={t("reservedEmptyTitle")}
          hint={t("reservedEmptyHint")}
        />
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {items.map((item) => (
          <ReservedItem key={item.id} boardId={item.board_id} item={item} />
        ))}
      </div>
    </div>
  );
}
