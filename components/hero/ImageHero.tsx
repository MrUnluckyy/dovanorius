import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";

export function ImageHero({ user }: { user?: User | null }) {
  const t = useTranslations("HomePage");

  return (
    <div className="mx-auto py-12 px-4 relative flex flex-col gap-12">
      {/*
      <img
        src="/assets/doodles/cream.svg"
        alt="illustration of stars"
        className="absolute left-[24%] top-[32%]"
      />
      <img
        src="/assets/doodles/coffee.svg"
        alt="illustration of stars"
        className="absolute left-[12%] bottom-[40%]"
      />
      <img
        src="/assets/doodles/star-lines.svg"
        alt="illustration of stars"
        className="absolute left-[6%] top-[29%]"
      />
      <img
        src="/assets/doodles/star-lines.svg"
        alt="illustration of stars"
        className="absolute left-[5%] top-[32%] w-3"
      />
      <img
        src="/assets/doodles/book.svg"
        alt="illustration of book"
        className="absolute left-[5%] top-[30%] w-24"
      />
      <img
        src="/assets/doodles/headphones.svg"
        alt="illustration of headphones"
        className="absolute left-[20%] bottom-20 w-32"
      />

      <img
        src="/assets/doodles/cat.svg"
        alt="illustration of woman"
        className="absolute right-[20%] top-[5  0%]"
      />
      */}
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
        <p className="font-special mt-6 text-xl md:text-2xl max-w-xl mx-auto">
          {t("description")}
        </p>
        <Link
          href="boards"
          className="btn btn-primary font-heading btn-md md:btn-lg mt-8"
        >
          {t("ctaTryOut")}
        </Link>
      </div>
    </div>
  );
}
