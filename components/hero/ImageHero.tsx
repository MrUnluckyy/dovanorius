import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";
import { AppStoreBadge } from "@/components/landing/AppStoreBadge";

export function ImageHero() {
  const t = useTranslations("HomePage");

  return (
    <div className="mx-auto py-12 px-4 relative flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 max-w-[1440px] w-full">
      <div className="flex-1">
        <h1 className="font-bold font-heading text-5xl md:text-6xl mb-4">
          {t("title")}
        </h1>
        <p className="font-body mt-6 text-lg md:text-xl">{t("description")}</p>
        <div className="flex flex-col w-full md:w-auto flex-wrap items-center md:items-start gap-4 mt-8">
          <Link
            href="/dashboard"
            className="btn btn-primary font-heading btn-lg md:btn-xl w-full md:w-auto"
          >
            {t("ctaTryOut")}
          </Link>
          <AppStoreBadge />
        </div>
      </div>
      <div className="flex-1">
        <img
          src="/assets/dovanorius-animated.gif"
          alt="Moteris kuria norų sąrašą"
          className="max-w-sm lg:max-w-md mx-auto"
          fetchPriority="high"
          decoding="async"
          width={480}
          height={480}
        />
      </div>
      <div className="bg-secondary absolute w-full lg:w-[500px] xl:w-[600px] h-[900px] lg:h-[800px] -z-10 lg:-z-10 top-0 right-0 lg:-top-60 lg:right-0 xl:right-16 rounded-b-[80px]" />
    </div>
  );
}
