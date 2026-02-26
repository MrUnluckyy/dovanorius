// components/CategoryMosaicGrid.tsx
import Link from "next/link";
import Image from "next/image";
import React from "react";
import { BoardWithPreview } from "./BoardsList";
import { useFormatter, useTranslations } from "next-intl";
import { useBoardMembersMap } from "@/hooks/useMemberMap";
import { AvatarGroup } from "./AvatarGroup";

// type MosaicImage = {
//   src: string;
//   alt: string;
// };

// export type CategoryMosaicItem = {
//   key: string;
//   title: string;
//   emoji?: string;
//   href: string;
//   images: MosaicImage[]; // 3 (preferred) or 4
// };

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
    <section className="mx-auto w-full max-w-[1440px] py-6">
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, idx) => (
          <CategoryMosaicCard
            key={item.id}
            item={item}
            priority={idx < aboveTheFoldCount}
          />
        ))}
      </div>
    </section>
  );
}

const CategoryMosaicCard = React.memo(function CategoryMosaicCard({
  item,
  priority,
}: {
  item: BoardWithPreview;
  priority?: boolean;
}) {
  const format = useFormatter();
  const t = useTranslations<"Boards">("Boards");
  const imgs = item.preview_images.slice(0, 4);
  const now = new Date();

  const { membersByBoard } = useBoardMembersMap([item.id]);

  return (
    <Link
      href={`/boards/${item.id}`} // fallback to id if slug is missing
      className={cn(
        "group block rounded-3xl bg-neutral-50 p-3 shadow-sm ring-1 ring-black/5",
        "transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
      )}
      prefetch={false} // avoid extra work on landing; enable if you want
      aria-label={item.name}
    >
      {/* Mosaic */}
      <div className="overflow-hidden rounded-2xl bg-neutral-100">
        <div
          className={cn(
            "grid h-[150px] grid-cols-3 gap-2 md:h-[170px] lg:h-[190px]",
            imgs.length >= 4 ? "grid-rows-2" : "grid-rows-2"
          )}
        >
          {/* Large (left) */}
          <MosaicCell
            className="col-span-2 row-span-2"
            image={imgs[0]}
            priority={priority}
            sizes="(max-width: 768px) 45vw, 30vw"
          />

          {/* Right side (2 stacked) */}
          <MosaicCell
            className="col-span-1 row-span-1"
            image={imgs[1]}
            priority={priority}
            sizes="(max-width: 768px) 22vw, 15vw"
          />
          <MosaicCell
            className="col-span-1 row-span-1"
            image={imgs[2]}
            priority={priority}
            sizes="(max-width: 768px) 22vw, 15vw"
          />

          {/* Optional 4th (small overlay bottom-left of big) */}
          {imgs[3] ? <div className="pointer-events-none absolute" /> : null}
        </div>

        {/* Optional 4th image as a small “chip” */}
        {imgs[3] ? (
          <div className="relative -mt-10 ml-3 h-12 w-12 overflow-hidden rounded-xl ring-2 ring-white md:-mt-11 md:h-14 md:w-14">
            <Image
              src={imgs[3]}
              alt={`Preview image for ${item.name}`}
              fill
              className="object-cover"
              sizes="56px"
              priority={priority}
            />
          </div>
        ) : null}
      </div>

      {/* Title */}
      <div className="mt-3 flex flex-col items-baseline gap-2 px-1">
        <div className="flex justify-between items-center w-full">
          <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 md:text-2xl">
            {item.name}
          </h3>
          <div>
            {membersByBoard[item.id]?.length > 1 && (
              <AvatarGroup members={membersByBoard[item.id] || []} />
            )}
          </div>
        </div>
        <p className="text-semibold text-sm">
          {t("itemsCount", { count: item.item_count })}
        </p>
        <p className="text-semibold text-sm">
          {!item.last_item_added_at
            ? t("noItemsYet")
            : `${t("lastUpdated")} ${format.relativeTime(
                item.last_item_added_at,
                now
              )}`}
        </p>
      </div>

      {/* Subtle hover cue */}
      <div className="mt-1 px-1 text-sm text-neutral-500 opacity-0 transition group-hover:opacity-100">
        {t("ctaView")} &rarr;
      </div>
    </Link>
  );
});

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
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {image ? (
        <img
          src={image}
          alt="Preview image for board"
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-neutral-200" />
      )}
    </div>
  );
}
