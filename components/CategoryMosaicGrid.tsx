// components/CategoryMosaicGrid.tsx
import Link from "next/link";
import Image from "next/image";
import React from "react";

type MosaicImage = {
  src: string;
  alt: string;
};

export type CategoryMosaicItem = {
  key: string;
  title: string;
  emoji?: string;
  href: string;
  images: MosaicImage[]; // 3 (preferred) or 4
};

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CategoryMosaicGrid({
  items,
  aboveTheFoldCount = 4,
}: {
  items: CategoryMosaicItem[];
  /** how many cards should load images with priority */
  aboveTheFoldCount?: number;
}) {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 py-6">
      <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-3">
        {items.map((item, idx) => (
          <CategoryMosaicCard
            key={item.key}
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
  item: CategoryMosaicItem;
  priority?: boolean;
}) {
  const imgs = item.images.slice(0, 4);

  return (
    <div className="group block rounded-3xl bg-neutral-50 p-3 shadow-sm ring-1 ring-black/5">
      {/* Mosaic */}
      <div className="overflow-hidden rounded-2xl bg-neutral-100">
        <div
          className={cn(
            "grid h-[150px] grid-cols-3 gap-2 md:h-[170px] lg:h-[350px]",
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
              src={imgs[3].src}
              alt={imgs[3].alt}
              fill
              className="object-cover"
              sizes="56px"
              priority={priority}
            />
          </div>
        ) : null}
      </div>

      {/* Title */}
      <div className="mt-3 flex items-baseline gap-2 px-1">
        {item.emoji ? (
          <span className="text-lg leading-none" aria-hidden="true">
            {item.emoji}
          </span>
        ) : null}

        <h3 className="text-xl font-extrabold tracking-tight text-neutral-900 md:text-2xl">
          {item.title}
        </h3>
      </div>
    </div>
  );
});

function MosaicCell({
  className,
  image,
  priority,
  sizes,
}: {
  className: string;
  image?: MosaicImage;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {image?.src ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          className="object-cover"
          sizes={sizes}
          priority={priority}
          // Keep default lazy loading when not priority:
          loading={priority ? "eager" : "lazy"}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-neutral-200" />
      )}
    </div>
  );
}
