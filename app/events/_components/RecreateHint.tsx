"use client";

import { useTranslations } from "next-intl";
import { LuMessageCircle } from "react-icons/lu";
import { openContactChat } from "@/lib/report";

/**
 * Shown on /events/new when this organiser drew names in another event in
 * the last few days.
 *
 * A draw can't be changed once it's run, so the only way to adjust a rule or
 * swap a person is a new event. One group made three in a day ("Trečias
 * bandymas", "Ketvirtas bandymas") and never told us why. This asks, and is
 * honest that a redraw doesn't exist yet.
 */
export function RecreateHint({ name, slug }: { name: string; slug: string }) {
  const t = useTranslations("Contact");

  return (
    <div className="mx-auto w-full max-w-[440px] px-4 pt-6 md:pt-10">
      <div className="rounded-[20px] border border-(--nr-border) bg-(--nr-yellow-soft) p-4">
        <p className="font-semibold text-(--nr-ink)">{t("recreateTitle")}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-(--nr-ink-soft)">
          {t("recreateBody", { name })}
        </p>
        <button
          type="button"
          onClick={() =>
            openContactChat({
              reason: "recreated_event",
              detail: { previousEvent: slug },
              prompt: t("recreatedEventPrompt"),
            })
          }
          className="nr-btn nr-btn-dark nr-btn-sm mt-3"
        >
          <LuMessageCircle aria-hidden /> {t("recreateCta")}
        </button>
      </div>
    </div>
  );
}
