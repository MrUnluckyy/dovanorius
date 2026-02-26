// app/page.tsx (or wherever)
import {
  CategoryMosaicGrid,
  CategoryMosaicItem,
} from "@/components/CategoryMosaicGrid";
import { useTranslations } from "next-intl";
import Link from "next/link";

const items: CategoryMosaicItem[] = [
  {
    key: "kids",
    title: "Vaikeliui",
    emoji: "🐣",
    href: "/kategorija/vaikeliui",
    images: [
      { src: "/assets/images/examples/kids1.png", alt: "Kids camera item" },
      { src: "/assets/images/examples/kids2.png", alt: "Kids food bowl" },
      { src: "/assets/images/examples/kids3.png", alt: "Kids cups" },
    ],
  },
  {
    key: "home",
    title: "Namams",
    emoji: "🏡",
    href: "/kategorija/namams",
    images: [
      {
        src: "/assets/images/examples/house1.png",
        alt: "Mirror from Zara Home",
      },
      {
        src: "/assets/images/examples/house2.png",
        alt: "Candles from Zara Home",
      },
      { src: "/assets/images/examples/house3.png", alt: "Vaze from Zara Home" },
    ],
  },
  {
    key: "sports",
    title: "Sportui",
    emoji: "🏋️‍♂️",
    href: "/kategorija/namams",
    images: [
      { src: "/assets/images/examples/sports1.png", alt: "Hoka running shoe" },
      {
        src: "/assets/images/examples/sports2.png",
        alt: "Blitz sports sunglasses",
      },
      { src: "/assets/images/examples/sports3.png", alt: "Garmin Watch" },
    ],
  },
  {
    key: "pets",
    title: "Augintiniams",
    emoji: "🐶",
    href: "/kategorija/namams",
    images: [
      { src: "/assets/images/examples/pets1.png", alt: "Dog rain coat" },
      { src: "/assets/images/examples/pets2.png", alt: "Dogs bed" },
      { src: "/assets/images/examples/pets3.png", alt: "Dogs licking mat" },
    ],
  },
  {
    key: "activities",
    title: "Užsiėmimams",
    emoji: "🎨",
    href: "/kategorija/namams",
    images: [
      { src: "/assets/images/examples/activity1.png", alt: "Activity - spa" },
      {
        src: "/assets/images/examples/activity2.png",
        alt: "Activity - glamping",
      },
      { src: "/assets/images/examples/activity3.png", alt: "Activity - pool" },
    ],
  },
  //   {
  //     key: "games",
  //     title: "Stalo žaidimams",
  //     emoji: "🎲",
  //     href: "/kategorija/namams",
  //     images: [
  //       { src: "/assets/images/examples/games1.png", alt: "games item" },
  //       { src: "/assets/images/examples/games2.png", alt: "games item" },
  //       { src: "/assets/images/examples/games3.png", alt: "games item" },
  //     ],
  //   },
  {
    key: "music",
    title: "Muzikai",
    emoji: "🎸",
    href: "/kategorija/namams",
    images: [
      { src: "/assets/images/examples/music1.png", alt: "Queens vinyl record" },
      {
        src: "/assets/images/examples/music2.png",
        alt: "Michael Jackson vinyl record",
      },
      {
        src: "/assets/images/examples/music3.png",
        alt: "Beatles vinyl record",
      },
    ],
  },
];

export function Examples() {
  const t = useTranslations("HomePage");

  return (
    <div className="mt-18 text-center">
      <h2 className="text-4xl md:text-5xl font-heading text-center font-bold mb-14">
        {t("examplesTitle")}
      </h2>
      <CategoryMosaicGrid items={items} aboveTheFoldCount={4} />
      <Link
        href="/dashboard"
        className="btn btn-primary font-heading btn-md md:btn-lg mt-8 mx-auto"
      >
        {t("ctaBuildYourWishList")}
      </Link>
    </div>
  );
}
