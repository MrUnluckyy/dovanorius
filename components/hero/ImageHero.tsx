import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export function ImageHero({ user }: { user?: User | null }) {
  const t = useTranslations("HomePage");

  return (
    <div className="max-w-[1440px] mx-auto py-12 px-4 relative flex flex-col gap-12">
      <div className="text-center px-8 pt-30 pb-30 bg-primary rounded-2xl">
        <h2 className="font-bold text-3xl md:text-5xl">{t("title")}</h2>
        <Link href="boards" className="btn btn-accent btn-md md:btn-lg mt-8">
          {t("ctaTryOut")}
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start justify-center">
        <div className="card bg-accent shadow-lg">
          <figure className="h-[200px]">
            <img
              src="https://images.unsplash.com/photo-1597892657493-6847b9640bac?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=987"
              alt="Running shoes"
            />
          </figure>
          <div className="card-body text-accent-content gap-4">
            <h2 className="card-title">{t("board1title")}</h2>
            <p className="line-clamp-3">{t("board1description")}</p>
            <div className="card-actions justify-end">
              <Link href="/boards" className="btn btn-primary">
                {t("ctaCreate")}
              </Link>
            </div>
          </div>
        </div>
        <div className="card bg-accent shadow-lg">
          <figure className="h-[200px]">
            <img
              src="https://images.unsplash.com/photo-1595960684234-49d2a004e753?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=980"
              alt="Kayaking"
            />
          </figure>
          <div className="card-body text-accent-content gap-4">
            <h2 className="card-title">{t("board2title")}</h2>
            <p className="line-clamp-3">{t("board2description")}</p>
            <div className="card-actions justify-end">
              <Link href="/boards" className="btn btn-primary">
                {t("ctaCreate")}
              </Link>
            </div>
          </div>
        </div>
        <div className="card bg-accent shadow-lg">
          <figure className="h-[200px]">
            <img
              src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1364"
              alt="Camera"
            />
          </figure>
          <div className="card-body text-accent-content gap-4">
            <h2 className="card-title">{t("board3title")}</h2>
            <p className="line-clamp-3">{t("board3description")}</p>
            <div className="card-actions justify-end">
              <Link href="/boards" className="btn btn-primary">
                {t("ctaCreate")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
