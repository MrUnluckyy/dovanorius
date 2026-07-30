"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Reveal } from "@/components/ui/Reveal";

/**
 * "For any occasion" — two rows of occasion pills that slide horizontally in
 * opposite directions as the section scrolls through the viewport (scroll-linked
 * horizontal parallax). Part of the Noriuto design system.
 */
export function Occasions() {
  const t = useTranslations("Landing.occasions");
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const row1Ref = useRef<HTMLDivElement | null>(null);
  const row2Ref = useRef<HTMLDivElement | null>(null);

  const rowA = [
    { emoji: "🎄", label: t("xmas") },
    { emoji: "🎂", label: t("birthday") },
    { emoji: "👶", label: t("babyShower") },
    { emoji: "🎓", label: t("graduation") },
    { emoji: "💍", label: t("wedding") },
    { emoji: "🏡", label: t("housewarming") },
  ];
  const rowB = [
    { emoji: "🎁", label: t("secretSanta") },
    { emoji: "🌸", label: t("namesday") },
    { emoji: "🐣", label: t("easter") },
    { emoji: "❤️", label: t("valentines") },
    { emoji: "🥂", label: t("anniversary") },
    { emoji: "🔑", label: t("newHome") },
  ];

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    const AMOUNT = 190; // px of horizontal travel across the scroll pass
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress: +0.5 below centre → 0 at centre → -0.5 above centre
      const p = (rect.top + rect.height / 2 - vh / 2) / vh;
      if (row1Ref.current)
        row1Ref.current.style.transform = `translate3d(${-60 - p * AMOUNT}px,0,0)`;
      if (row2Ref.current)
        row2Ref.current.style.transform = `translate3d(${-140 + p * AMOUNT}px,0,0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const Pill = ({ emoji, label }: { emoji: string; label: string }) => (
    <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-(--nr-border) bg-white px-5 py-3 shadow-[0_2px_10px_rgba(35,31,24,0.04)]">
      <span className="text-[22px] leading-none">{emoji}</span>
      <span className="whitespace-nowrap text-[15px] font-semibold text-(--nr-ink)">
        {label}
      </span>
    </div>
  );

  return (
    <section className="nr-section overflow-hidden">
      <div className="nr-container">
        <Reveal className="mx-auto mb-10 max-w-[640px] text-center">
          <span className="nr-badge nr-badge-tint mb-3.5">{t("overline")}</span>
          <h2 className="nr-h2 mb-3 text-[30px] md:text-[40px]">{t("title")}</h2>
          <p className="nr-lead mx-auto max-w-[520px] text-[17px]">
            {t("subtitle")}
          </p>
        </Reveal>
      </div>

      <div
        ref={sectionRef}
        className="nr-marquee-mask flex flex-col gap-4"
      >
        <div ref={row1Ref} className="flex w-max gap-4 will-change-transform">
          {[...rowA, ...rowA, ...rowA].map((o, i) => (
            <Pill key={`a-${i}`} {...o} />
          ))}
        </div>
        <div ref={row2Ref} className="flex w-max gap-4 will-change-transform">
          {[...rowB, ...rowB, ...rowB].map((o, i) => (
            <Pill key={`b-${i}`} {...o} />
          ))}
        </div>
      </div>
    </section>
  );
}
