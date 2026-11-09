"use client";

import { useTranslations } from "next-intl";
import { openConsentSettings } from "@/lib/consent";

/** Reopens the cookie settings; withdrawing consent must stay one tap away. */
export function ConsentSettingsLink({ className = "" }: { className?: string }) {
  const t = useTranslations("Consent");
  return (
    <button type="button" onClick={openConsentSettings} className={className}>
      {t("settingsLink")}
    </button>
  );
}
