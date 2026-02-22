import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";

export function ImageHero() {
  const t = useTranslations("HomePage");

  return (
    <div className="mx-auto py-12 px-4 relative flex items-center justify-center gap-12 max-w-[1440px] w-full">
      <div className="flex-1">
        <h2 className="font-bold font-heading text-6xl md:text-6xl mb-4">
          {t("title")}
        </h2>
        <p className="font-body mt-6 text-xl md:text-xl">{t("description")}</p>
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
          className="max-w-md mx-auto"
        />
      </div>
      <div className="bg-secondary absolute w-[600px] h-[800px] -z-10 -top-60 right-16 rounded-b-[80px]" />
    </div>
  );
}
