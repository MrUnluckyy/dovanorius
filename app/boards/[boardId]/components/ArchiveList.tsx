"use client";

import { format } from "date-fns";
import { enUS, lt } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { LuUndo2 } from "react-icons/lu";

import { FillImage } from "@/components/ui/FillImage";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { useBoardArchive, useRevertPurchase } from "@/hooks/useBoardArchive";

const PLACEHOLDER = "/assets/placeholder.jpg";

/**
 * Wishes marked as received, with a way back. Rows rather than the wish grid's
 * cards — these are history, not something you act on beyond restoring, and the
 * date + restore button read better on a line. Mirrors ArchivedItemRow in the
 * mobile app.
 */
export function ArchiveList({ boardId }: { boardId: string }) {
  const t = useTranslations("Boards");
  const locale = useLocale();
  const { data: items = [], isLoading, error } = useBoardArchive(boardId);
  const revert = useRevertPurchase(boardId);

  if (isLoading) return <BoardsLoadingSkeleton />;

  if (error) return <p className="text-error">😵 {t("errorArchiveLoad")}</p>;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
        <p className="font-medium">{t("archiveEmptyTitle")}</p>
        <p className="text-sm opacity-60">{t("archiveEmptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm opacity-60">{t("archiveHint")}</p>

      <ul className="divide-base-300 divide-y">
        {items.map((item) => {
          const imgSrc = item.image_urls?.[0] ?? item.image_url ?? PLACEHOLDER;
          const isPending = revert.isPending && revert.variables === item.id;

          return (
            <li key={item.id} className="flex items-center gap-4 py-3">
              <div className="relative aspect-square w-14 shrink-0 overflow-hidden rounded-md">
                <FillImage
                  src={imgSrc}
                  alt={item.title ?? "Gift image"}
                  sizes="56px"
                  className="object-cover object-center"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium" data-clarity-mask="true">
                  {item.title}
                </p>
                {item.purchased_at && (
                  <p className="text-sm opacity-60">
                    {t("receivedOn", {
                      date: format(new Date(item.purchased_at), "PPP", {
                        locale: locale === "lt" ? lt : enUS,
                      }),
                    })}
                  </p>
                )}
              </div>

              <button
                className="btn btn-sm btn-outline shrink-0"
                disabled={isPending}
                onClick={() => revert.mutate(item.id)}
              >
                {isPending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <LuUndo2 />
                )}
                {t("ctaRestore")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
