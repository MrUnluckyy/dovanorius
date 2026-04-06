import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { AppStoreBadge } from "@/components/landing/AppStoreBadge";

export function PreFooterCTA() {
  const t = useTranslations("HomePage");

  return (
    <div className="relative mt-30 flex flex-col gap-4 justify-center items-center text-center max-w-md mx-auto px-4">
      <div className="bg-linear-to-t from-[#FFE035] to-base-100 to-90% w-[2000px] h-lvh absolute -z-10" />
      <div>
        <img src="/assets/doodles/heart-lines.svg" className="w-16" />
      </div>

      <h2 className="text-4xl md:text-5xl font-heading text-center font-bold max-w-md">
        {t("preFooterCTATitle")}
      </h2>
      <p className="max-w-md text-neutral">{t("preFooterCTADescription")}</p>

      <Link
        href="/dashboard"
        className="btn btn-primary font-heading btn-md md:btn-lg"
      >
        {t("ctaStartBuilding")}
      </Link>

      <div className="divider text-neutral text-xs">
        {t("appDownloadDivider")}
      </div>
      <div className="flex flex-col items-center gap-3">
        <AppStoreBadge />
        <div className="opacity-35 grayscale">
          <Image
            src="/assets/googlePlay.png"
            alt="Google Play – coming soon"
            width={135}
            height={40}
          />
        </div>
      </div>
    </div>
  );
}
