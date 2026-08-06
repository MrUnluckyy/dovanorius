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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on Escape and once the viewport grows past the
  // breakpoint, so it never lingers behind the restored desktop nav.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => mq.matches && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onChange);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const burgerLine =
    "absolute left-0 block h-[2px] w-full rounded-full bg-current transition-all duration-300 ease-[var(--nr-ease-spring)]";

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 backdrop-blur-md transition-colors duration-300"
        style={{
          background:
            scrolled || menuOpen
              ? "rgba(246,241,230,0.95)"
              : "rgba(250,247,240,0.7)",
          borderBottom: `1px solid ${
            scrolled || menuOpen ? "var(--nr-border)" : "transparent"
          }`,
        }}
      >
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-[18px] py-3 md:px-12">
          {/* Left: logo + search */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5"
            >
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

          {/* Right: desktop nav + auth */}
          <nav className="hidden items-center gap-1 text-[15px] font-medium md:flex md:gap-2">
            <Link
              href="#kaip-veikia"
              className="rounded-full px-3 py-1.5 text-(--nr-muted) transition-colors hover:text-(--nr-ink)"
            >
              {t("howItWorks")}
            </Link>

            <Link
              href="/login"
              className="rounded-full px-3 py-1.5 text-(--nr-ink) transition-colors hover:text-(--nr-muted)"
            >
              {t("login")}
            </Link>
            <Link href="/register" className="nr-btn nr-btn-dark nr-btn-sm ml-1">
              {t("register")}
            </Link>
          </nav>

          {/* Right: mobile burger */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
            className="relative -mr-1 flex h-10 w-10 items-center justify-center rounded-full text-(--nr-ink) transition-colors hover:bg-(--nr-tile)/70 md:hidden"
          >
            <span className="relative block h-4 w-[22px]">
              <span
                className={`${burgerLine} ${
                  menuOpen ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
                }`}
              />
              <span
                className={`${burgerLine} top-1/2 -translate-y-1/2 ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`${burgerLine} ${
                  menuOpen ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
                }`}
              />
            </span>
          </button>
        </div>

      </header>

      {/* Mobile full-height menu — sits under the fixed header bar (z-50) so the
          logo, search and close button stay tappable on top of it. */}
      <div
        id="landing-mobile-menu"
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 flex flex-col bg-(--nr-cream) transition-[opacity,transform] duration-300 ease-[var(--nr-ease-out-expo)] md:hidden ${
          menuOpen ? "" : "pointer-events-none"
        }`}
        style={{
          opacity: menuOpen ? 1 : 0,
          transform: menuOpen ? "translateY(0)" : "translateY(-8px)",
        }}
      >
        <nav className="flex h-full flex-col px-[18px] pt-[76px] pb-[max(2rem,env(safe-area-inset-bottom))]">
          <Link
            href="#kaip-veikia"
            onClick={() => setMenuOpen(false)}
            className="rounded-xl px-3 py-3.5 text-[18px] font-semibold text-(--nr-ink) transition-colors hover:bg-(--nr-tile)/70"
          >
            {t("howItWorks")}
          </Link>

          {/* Auth actions — both are buttons; login reads as the secondary of a
              matched pair rather than a de-emphasised nav link. */}
          <div className="mt-auto flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="nr-btn nr-btn-outline w-full"
            >
              {t("login")}
            </Link>
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              className="nr-btn nr-btn-dark w-full"
            >
              {t("register")}
            </Link>
          </div>
        </nav>
      </div>
      {/* spacer for the fixed header */}
      <div className="h-[60px]" />
    </>
  );
}
