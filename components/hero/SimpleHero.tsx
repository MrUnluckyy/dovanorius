import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";

export function SimpleHero({ user }: { user: User | null }) {
  const t = useTranslations("HomePage");
  return (
    <div className="hero bg-base-200 min-h-screen">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold">{t("title")}</h1>
          <p className="py-6">{t("description")}</p>
          {user?.id ? (
            <Link href={`/boards`} className="btn btn-primary">
              {t("buttonText")}
            </Link>
          ) : (
            <Link href={`/boards`} className="btn btn-primary">
              {t("buttonText")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
