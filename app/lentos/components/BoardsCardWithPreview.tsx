// components/CategoryMosaicGrid.tsx
import Link from "next/link";
import React from "react";
import { BoardWithPreview } from "./BoardsList";
import { useFormatter, useTranslations } from "next-intl";
import { useBoardMembersMap } from "@/hooks/useMemberMap";
import { AvatarGroup } from "./AvatarGroup";
import { LinkPendingRibbon } from "@/components/ui/LinkPending";
import { Hero3D } from "@/components/ui/Hero3D";
import { LuLock } from "react-icons/lu";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CategoryMosaicGrid({
  items,
  aboveTheFoldCount = 4,
}: {
  items: BoardWithPreview[];
  /** how many cards should load images with priority */
  aboveTheFoldCount?: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, idx) => (
        <CategoryMosaicCard
          key={item.id}
          item={item}
          priority={idx < aboveTheFoldCount}
        />
      ))}
    </div>
  );
}

const CategoryMosaicCard = React.memo(function CategoryMosaicCard({
  item,
  priority,
}: {
  item: BoardWithPreview;
  priority?: boolean;
}) {
  const { membersByBoard } = useBoardMembersMap([item.id]);
  return (
    <BoardCard
      href={`/lentos/${item.id}`}
      name={item.name}
      itemCount={item.item_count}
      previewImages={item.preview_images}
      isPublic={item.is_public}
      lastItemAddedAt={item.last_item_added_at}
      members={membersByBoard[item.id]}
      priority={priority}
    />
  );
});

/**
 * One board as a card: photo mosaic (or a gift when it has none), name, count.
 * Shared by the dashboard and public profiles so the two can't drift.
 */
export function BoardCard({
  href,
  name,
  itemCount,
  previewImages,
  isPublic = true,
  lastItemAddedAt,
  members,
  priority,
}: {
  href: string;
  name: string;
  itemCount: number;
  previewImages?: string[] | null;
  isPublic?: boolean;
  lastItemAddedAt?: Date | string | null;
  members?: React.ComponentProps<typeof AvatarGroup>["members"];
  priority?: boolean;
}) {
  const format = useFormatter();
  const t = useTranslations<"Boards">("Boards");
  const imgs = previewImages?.slice(0, 3) ?? [];
  const now = new Date();

  return (
    <Link
      href={href}
      className={cn(
        "group relative block rounded-3xl border border-(--nr-border) bg-(--nr-surface) p-3",
        "transition hover:-translate-y-0.5 hover:shadow-[var(--nr-shadow-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-(--nr-yellow-deep)"
      )}
      // Prefetch on purpose: this card exists to open that board, and the
      // route behind it is server-rendered. Opting out meant every click paid
      // for the whole round-trip with nothing on screen.
      aria-label={name}
    >
      <LinkPendingRibbon />
      {imgs.length === 0 ? (
        // No photos yet. This used to be a pulsing grey block, which read as
        // "still loading" forever on every new board.
        <div className="grid h-[150px] place-items-center rounded-2xl bg-(--nr-tile) md:h-[170px]">
          <Hero3D name="gift" size={64} still />
        </div>
      ) : (
        <div className="grid h-[150px] grid-cols-3 grid-rows-2 gap-1.5 overflow-hidden rounded-2xl md:h-[170px]">
          <MosaicCell
            className={imgs.length === 1 ? "col-span-3 row-span-2" : "col-span-2 row-span-2"}
            image={imgs[0]}
            priority={priority}
            sizes="(max-width: 768px) 60vw, 30vw"
          />
          {imgs.length > 1 && (
            <MosaicCell
              className={imgs.length === 2 ? "col-span-1 row-span-2" : "col-span-1 row-span-1"}
              image={imgs[1]}
              priority={priority}
              sizes="(max-width: 768px) 30vw, 15vw"
            />
          )}
          {imgs.length > 2 && (
            <MosaicCell
              className="col-span-1 row-span-1"
              image={imgs[2]}
              priority={priority}
              sizes="(max-width: 768px) 30vw, 15vw"
            />
          )}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1 px-1">
        <div className="flex w-full items-center justify-between gap-2">
          <h3 className="font-heading flex min-w-0 items-center gap-1.5 text-xl font-bold tracking-tight">
            <span className="truncate">{name}</span>
            {!isPublic && (
              <LuLock
                className="w-4 shrink-0 text-(--nr-muted)"
                aria-label={t("private")}
              />
            )}
          </h3>
          {members && members.length > 1 && <AvatarGroup members={members} />}
        </div>
        <p className="text-sm text-(--nr-muted)">
          {t("itemsCount", { count: itemCount })}
          {lastItemAddedAt && (
            <>
              {" · "}
              {t("lastUpdated")}{" "}
              {format.relativeTime(new Date(lastItemAddedAt), now)}
            </>
          )}
        </p>
      </div>
    </Link>
  );
}

function MosaicCell({
  className,
  image,
  priority,
  sizes,
}: {
  className: string;
  image?: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-(--nr-tile)", className)}>
      {image && (
        // Wish preview images are arbitrary retailer URLs — a plain <img>
        // avoids next/image's host allow-list.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      )}
    </div>
  );
}
