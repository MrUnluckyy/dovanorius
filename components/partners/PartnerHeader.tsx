"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

const CONTACT = "mailto:partneriai@noriuto.lt";

/**
 * Header for the public partners / for-business pitch page (/partneriams).
 * Same Noriuto chrome as the consumer header, but business-oriented actions:
 * partner login + a "contact us" CTA. Standalone (LT), no locale switcher.
 */
export function PartnerHeader() {
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
          <div className="flex items-center gap-2.5">
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
            <span className="rounded-full bg-(--nr-tile) px-2.5 py-1 text-[12px] font-bold text-(--nr-gold-strong)">
              Verslui
            </span>
          </div>

          <nav className="flex items-center gap-1 text-[15px] font-medium sm:gap-3">
            <Link
              href="/partner/login"
              className="hidden rounded-full px-3 py-1.5 text-(--nr-muted) transition-colors hover:text-(--nr-ink) sm:block"
            >
              Partnerio prisijungimas
            </Link>
            <Link href={CONTACT} className="nr-btn nr-btn-dark nr-btn-sm">
              Susisiekime
            </Link>
          </nav>
        </div>
      </header>
      <div className="h-[60px]" />
    </>
  );
}
