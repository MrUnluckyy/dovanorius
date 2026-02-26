import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";

export function ImageHero() {
  const t = useTranslations("HomePage");

  return (
    <div className="mx-auto py-12 px-4 relative flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 max-w-[1440px] w-full">
      <div className="flex-1">
        <h1 className="font-bold font-heading text-5xl md:text-6xl mb-4">
          {t("title")}
        </h1>
        <p className="font-body mt-6 text-lg md:text-xl">{t("description")}</p>
        <Link
          href="/dashboard"
          className="btn btn-primary font-heading btn-md md:btn-lg mt-8"
        >
          {t("ctaTryOut")}
        </Link>
      </div>
      <div className="flex-1">
        <img
          src="/assets/dovanorius-animated.gif"
          alt="illustration of woman"
          className="max-w-sm lg:max-w-md mx-auto"
        />
      </div>
      <div className="bg-secondary absolute w-full lg:w-[500px] xl:w-[600px] h-[900px] lg:h-[800px] -z-10 lg:-z-10 top-0 right-0 lg:-top-60 lg:right-0 xl:right-16 rounded-b-[80px]" />
    </div>
  );
}
