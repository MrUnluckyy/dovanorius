import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";

export function ImageHero() {
  const t = useTranslations("HomePage");

  return (
    <div className="mx-auto py-12 px-4 relative flex flex-col gap-12">
      <img
        src="/assets/doodles/girl.svg"
        alt="illustration of woman"
        className="absolute right-1 xl:right-[15%] bottom-[10%] hidden md:block w-48 md:w-64 lg:w-80"
      />
      <div className="px-8 pt-30 pb-30 text-center max-w-[1440px] mx-auto relative">
        <img
          src="/assets/doodles/stars-hearts-combo.svg"
          alt="illustration of stars"
          className="absolute left-5 top-[15%] md:hidden"
        />
        <h2 className="font-bold font-special text-4xl md:text-5xl mb-4">
          {t("title")}
        </h2>
        <p className="font-heading mt-6 text-xl md:text-xl max-w-xl mx-auto">
          {t("description")}
        </p>
        <Link
          href="/dashboard"
          className="btn btn-primary font-heading btn-md md:btn-lg mt-8"
        >
          {t("ctaTryOut")}
        </Link>
      </div>
    </div>
  );
}
