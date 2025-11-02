// app/_components/LocaleSwitcher.tsx
"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/app/actions/action";

const LOCALES = ["en", "lt"] as const;

export function LocaleSwitcher() {
  const active = useLocale();
  const [isPending, startTransition] = useTransition();

  const getLocaleLabel = (locale: string) => {
    if (locale === "en") return "🇬🇧";
    return "🇱🇹";
  };

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          console.log("TRANSITIONING");
          await setLocale(formData);
          // Force client to reflect the new cookie
          window.location.reload();
        });
      }}
    >
      <select
        name="locale"
        defaultValue={active}
        disabled={isPending}
        aria-label="Change language"
        onChange={(e) => e.target.form?.requestSubmit()}
        className="select select-ghost text-lg"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {getLocaleLabel(l)}
          </option>
        ))}
      </select>
    </form>
  );
}
