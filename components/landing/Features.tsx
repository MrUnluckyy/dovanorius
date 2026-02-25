import { useTranslations } from "next-intl";
import Image from "next/image";
import React from "react";

export function Features() {
  const t = useTranslations("HomePage");

  return (
    <div className="max-w-[1440px] mx-auto px-8 mt-30 relative">
      <div className="flex flex-col md:flex-row gap-8 mt-10 items-start">
        <div className="card bg-transparent flex-1">
          <figure className="relative rounded-2xl aspect-square w-full overflow-hidden">
            <Image
              src="/assets/shoe.png"
              alt="Norų sąrašo pavizdys"
              fill
              className="object-cover"
            />
          </figure>
          <div className="card-body justify-center align-center text-center">
            <h2 className="font-heading text-4xl font-bold">
              {t("concreteWish")}
            </h2>
            <p className="line-clamp-2 text-neutral">
              {t("concreteWishDescription")}
            </p>
          </div>
        </div>

        <div className="card bg-transparent flex-1">
          <figure className="relative rounded-2xl aspect-square w-full overflow-hidden">
            <Image
              src="/assets/boards.png"
              alt="Norų sąrašo pavizdys"
              fill
              className="object-cover"
            />
          </figure>
          <div className="card-body justify-center align-center text-center">
            <h2 className="font-heading text-4xl font-bold">
              {t("wishBoards")}
            </h2>
            <p className="line-clamp-2 text-neutral">
              {t("wishBoardsDescription")}
            </p>
          </div>
        </div>

        <div className="card bg-transparent flex-1">
          <figure className="relative rounded-xl aspect-square w-full overflow-hidden">
            <Image
              src="/assets/gift-exchange.jpg"
              alt="Norų sąrašo pavizdys"
              fill
              className="object-cover"
            />
          </figure>
          <div className="card-body justify-center align-center text-center">
            <h2 className="font-heading text-4xl font-bold">
              {t("giftExchange")}
            </h2>
            <p className="line-clamp-2 text-neutral">
              {t("giftExchangeDescription")}
            </p>
          </div>
        </div>
      </div>
      <img
        src="/assets/doodles/arrow.svg"
        className="absolute rotate-180 top-0 -left-32"
      />
      <img src="/assets/doodles/arrow.svg" className="absolute -right-32" />
    </div>
  );
}
