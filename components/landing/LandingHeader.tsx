"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LandingSearch } from "@/components/landing/LandingSearch";

/**
 * Marketing header for the logged-out landing page.
 * Translucent cream bar that gains a hairline + solid shade after 8px scroll.
 * Search sits by the logo; all controls share the muted → ink nav colours.
 * Part of the Noriuto design system — mirrors tokens in globals.css.
 */
export function LandingHeader() {
  const t = useTranslations("Landing.nav");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 backdrop-blur-md transition-colors duration-300"
        style={{
          background: scrolled ? "rgba(246,241,230,0.9)" : "rgba(250,247,240,0.7)",
          borderBottom: `1px solid ${scrolled ? "var(--nr-border)" : "transparent"}`,
        }}
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-[18px] py-3 md:px-12">
          {/* Left: logo + search */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/assets/logo.png"
                alt="Noriuto"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <span className="font-heading text-xl font-extrabold tracking-tight">
                noriuto
              </span>
            </Link>
            <span className="mx-1 hidden h-5 w-px bg-(--nr-border) sm:block" />
            <LandingSearch />
          </div>

          {/* Right: nav + auth */}
          <nav className="flex items-center gap-1 text-[15px] font-medium sm:gap-2">
            <Link
              href="#kaip-veikia"
              className="hidden rounded-full px-3 py-1.5 text-(--nr-muted) transition-colors hover:text-(--nr-ink) md:block"
            >
              {t("howItWorks")}
            </Link>

            <Link
              href="/login"
              className="rounded-full px-2.5 py-1.5 text-(--nr-ink) transition-colors hover:text-(--nr-muted) sm:px-3"
            >
              {t("login")}
            </Link>
            <Link
              href="/register"
              className="nr-btn nr-btn-dark nr-btn-sm ml-1"
            >
              {t("register")}
            </Link>
          </nav>
        </div>
      </header>
      {/* spacer for the fixed header */}
      <div className="h-[60px]" />
    </>
  );
}
