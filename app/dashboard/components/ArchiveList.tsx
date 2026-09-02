"use client";

import { format } from "date-fns";
import { enUS, lt } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { LuUndo2 } from "react-icons/lu";
import { User } from "@supabase/supabase-js";

import { FillImage } from "@/components/ui/FillImage";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { useMyArchive, useRevertPurchase } from "@/hooks/useArchive";

const PLACEHOLDER = "/assets/placeholder.jpg";

/**
 * Wishes marked as received across every board, with a way back. Rows rather
 * than the wish grid's cards — these are history, not something you act on
 * beyond restoring, and the date + restore button read better on a line.
 * Mirrors ArchivedItemRow in the mobile app.
 */
export function ArchiveList({ user }: { user: User }) {
  const t = useTranslations("Boards");
  const locale = useLocale();
  const { data: items = [], isLoading, error } = useMyArchive(user.id);
  const revert = useRevertPurchase();

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
                <p className="truncate text-sm opacity-60">
                  {item.purchased_at &&
                    t("receivedOn", {
                      date: format(new Date(item.purchased_at), "PPP", {
                        locale: locale === "lt" ? lt : enUS,
                      }),
                    })}
                  {/* Which list it came from, now that boards are mixed. */}
                  {item.board_name && (
                    <>
                      {item.purchased_at && " · "}
                      <Link
                        href={`/boards/${item.board_id}`}
                        className="hover:underline"
                      >
                        {item.board_name}
                      </Link>
                    </>
                  )}
                </p>
              </div>

              <button
                className="btn btn-sm btn-outline shrink-0"
                disabled={isPending}
                data-busy={isPending || undefined}
                onClick={() => revert.mutate(item.id)}
              >
                <LuUndo2 />
                {t("ctaRestore")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
