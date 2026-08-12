"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LocaleToggle } from "@/components/LocaleToggle";

export default function Footer() {
  const t = useTranslations("Landing.footer");
  return (
    <footer className="border-t border-(--nr-border)">
      <div className="nr-container flex flex-col items-center gap-5 py-7 text-[13px] text-(--nr-faint) md:flex-row md:justify-between">
        <div className="flex items-center gap-2">
          <Image src="/assets/logo.png" alt="Noriuto" width={22} height={22} />
          <span>{t("copyright", { year: new Date().getFullYear() })}</span>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link
            href="/blog"
            className="transition-colors hover:text-(--nr-ink)"
          >
            {t("blog")}
          </Link>
          <Link
            href="/partneriams"
            className="font-semibold text-(--nr-gold-strong) transition-colors hover:text-(--nr-ink)"
          >
            Partneriams
          </Link>
          <Link
            href="/privatumo-politika"
            className="transition-colors hover:text-(--nr-ink)"
          >
            {t("privacy")}
          </Link>
          <Link
            href="/slapuku-politika"
            className="transition-colors hover:text-(--nr-ink)"
          >
            {t("cookies")}
          </Link>
          <Link
            href="/naudojimo-politika"
            className="transition-colors hover:text-(--nr-ink)"
          >
            {t("terms")}
          </Link>
          <Link
            href="/atsakomybes-apribojimas"
            className="transition-colors hover:text-(--nr-ink)"
          >
            {t("disclaimer")}
          </Link>
        </nav>
        <LocaleToggle />
      </div>
    </footer>
  );
}
