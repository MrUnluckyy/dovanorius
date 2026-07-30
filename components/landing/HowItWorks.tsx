"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { LuArrowRight } from "react-icons/lu";
import { Reveal } from "@/components/ui/Reveal";

type T = ReturnType<typeof useTranslations>;

/* --- phone chrome ------------------------------------------------------ */
function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[600px] w-[300px] overflow-hidden rounded-[46px] border-[10px] border-(--nr-ink) bg-white shadow-[var(--nr-shadow-device)]">
      <div className="absolute left-1/2 top-2.5 z-10 h-[26px] w-[110px] -translate-x-1/2 rounded-[14px] bg-(--nr-ink)" />
      <div className="absolute inset-0 bg-(--nr-cream) px-[18px] pb-[18px] pt-[52px]">
        {children}
      </div>
    </div>
  );
}

function HintChip({
  emoji,
  line1,
  line2,
}: {
  emoji: string;
  line1: string;
  line2: string;
}) {
  return (
    <div className="mt-auto flex items-center gap-2.5 rounded-[13px] bg-white px-3.5 py-3 shadow-[0_8px_22px_rgba(35,31,24,0.12)]">
      <span className="text-lg">{emoji}</span>
      <div className="text-[11.5px] font-semibold leading-tight">
        {line1}
        <br />
        <span className="font-normal text-(--nr-faint)">{line2}</span>
      </div>
    </div>
  );
}

function ShotReceiver({ t }: { t: T }) {
  const items = [
    { emoji: "🧸", bg: "#FFE3A8", name: t("itemBear"), price: "24 €" },
    { emoji: "🧩", bg: "#FFF4D6", name: t("itemBlocks"), price: "34 €" },
    { emoji: "🌙", bg: "#F3EBDD", name: t("itemLight"), price: "22 €" },
  ];
  return (
    <div className="flex h-full flex-col gap-3.5">
      <div className="flex items-center gap-2">
        <span className="font-heading text-[22px] font-extrabold tracking-tight">
          🐣 {t("receiverBoard")}
        </span>
        <span className="nr-badge nr-badge-tint !px-2.5 !py-1 !text-[11px]">
          {t("receiverCount")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <div
            key={it.name}
            className="overflow-hidden rounded-2xl border border-(--nr-border) bg-white"
          >
            <div
              className="flex h-20 items-center justify-center text-3xl"
              style={{ background: it.bg }}
            >
              {it.emoji}
            </div>
            <div className="px-3 py-2.5">
              <div className="text-xs font-bold">{it.name}</div>
              <div className="text-[11px] font-semibold text-(--nr-gold-text)">
                {it.price}
              </div>
            </div>
          </div>
        ))}
        <div className="flex min-h-[128px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[#e6ddc9]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-(--nr-yellow) text-lg font-extrabold">
            +
          </span>
          <span className="text-[11.5px] font-semibold text-(--nr-faint)">
            {t("addWish")}
          </span>
        </div>
      </div>
      <HintChip emoji="📲" line1={t("receiverHint")} line2={t("receiverHintSub")} />
    </div>
  );
}

function ShotGiver({ t }: { t: T }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-(--nr-yellow) text-sm font-extrabold">
          A
        </div>
        <div>
          <div className="text-[13.5px] font-bold">{t("giverBoard")}</div>
          <div className="text-[11px] text-(--nr-faint)">{t("giverOccasion")}</div>
        </div>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-(--nr-border) bg-white">
        <div className="flex h-[104px] items-center justify-center bg-[#FFE3A8] text-[44px]">
          🎧
        </div>
        <div className="px-3.5 pb-3.5 pt-3">
          <div className="text-sm font-bold">{t("itemHeadphones")}</div>
          <div className="mb-2.5 mt-0.5 text-xs font-semibold text-(--nr-gold-text)">
            89 €
          </div>
          <div className="rounded-full bg-(--nr-yellow) py-2.5 text-center text-[12.5px] font-bold shadow-[var(--nr-shadow-btn)]">
            {t("reserve")}
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-(--nr-border) bg-white opacity-75">
        <div className="flex items-center justify-between px-3.5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F3EBDD] text-2xl saturate-50">
              📚
            </div>
            <div>
              <div className="text-[13px] font-bold">{t("itemBook")}</div>
              <div className="text-[11px] font-semibold text-(--nr-gold-text)">
                18 €
              </div>
            </div>
          </div>
          <span className="rounded-full bg-(--nr-ink) px-2.5 py-1.5 text-[10.5px] font-bold text-white">
            {t("reservedBadge")}
          </span>
        </div>
      </div>
      <HintChip emoji="🤫" line1={t("giverHint")} line2={t("giverHintSub")} />
    </div>
  );
}

function ShotEvent({ t }: { t: T }) {
  return (
    <div className="flex h-full flex-col gap-3">
      {/* event header */}
      <div className="rounded-[20px] bg-(--nr-yellow) px-4 pb-3.5 pt-4">
        <div className="font-heading text-xl font-extrabold tracking-tight">
          🎄 {t("eventTitle")}
        </div>
        <div className="mt-0.5 text-[11.5px] font-semibold text-(--nr-on-yellow-muted)">
          {t("eventMeta")}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex">
            {["A", "T", "G", "K"].map((l, i) => (
              <div
                key={l}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-(--nr-yellow) text-xs font-extrabold"
                style={{
                  background: i % 2 ? "#FFF4D6" : "#fff",
                  marginLeft: i === 0 ? 0 : -9,
                }}
              >
                {l}
              </div>
            ))}
            <div
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-(--nr-yellow) bg-(--nr-ink) text-[10px] font-bold text-white"
              style={{ marginLeft: -9 }}
            >
              +2
            </div>
          </div>
          {/* gift cap */}
          <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-(--nr-on-yellow-muted)">
            💶 {t("giftCap")}
          </span>
        </div>
      </div>

      {/* name-draw result */}
      <div className="rounded-2xl border border-(--nr-border) bg-white p-4">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-(--nr-gold-strong)">
          🎁 {t("drawLabel")}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--nr-yellow) text-base font-extrabold">
            K
          </div>
          <div className="text-[17px] font-bold">{t("drawName")}</div>
        </div>
        {/* view wishes CTA — real icon, not a text chevron */}
        <div className="mt-3.5 flex items-center justify-between rounded-full bg-(--nr-tile) px-4 py-2.5">
          <span className="text-[12.5px] font-bold text-(--nr-ink)">
            {t("viewWishes")}
          </span>
          <LuArrowRight className="text-[15px] text-(--nr-gold-strong)" />
        </div>
      </div>

      <HintChip emoji="🤫" line1={t("eventHint")} line2={t("eventHintSub")} />
    </div>
  );
}

function Check() {
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-(--nr-tile) text-[12px]">
      ✓
    </span>
  );
}

function StepText({
  overline,
  title,
  body,
  points,
  dim = false,
}: {
  overline: string;
  title: string;
  body: string;
  points: string[];
  dim?: boolean;
}) {
  return (
    <div
      className="transition-opacity duration-500"
      style={{ opacity: dim ? 0.35 : 1 }}
    >
      <span className="nr-badge nr-badge-solid mb-4 !tracking-wider">
        {overline.toUpperCase()}
      </span>
      <h3 className="nr-h3 mb-3.5 text-[26px] md:text-[34px]">{title}</h3>
      <p className="mb-6 max-w-[480px] text-[17px] leading-relaxed text-(--nr-muted)">
        {body}
      </p>
      <ul className="flex flex-col gap-3">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2.5 text-[15px] font-semibold">
            <Check />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HowItWorks() {
  const t = useTranslations("Landing.how");
  const [active, setActive] = useState(0);
  const [phoneScale, setPhoneScale] = useState(1);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const steps = [
    {
      overline: t("step1Overline"),
      title: t("step1Title"),
      body: t("step1Body"),
      points: [t("step1P1"), t("step1P2"), t("step1P3")],
      shot: <ShotReceiver t={t} />,
    },
    {
      overline: t("step2Overline"),
      title: t("step2Title"),
      body: t("step2Body"),
      points: [t("step2P1"), t("step2P2"), t("step2P3")],
      shot: <ShotGiver t={t} />,
    },
    {
      overline: t("step3Overline"),
      title: t("step3Title"),
      body: t("step3Body"),
      points: [t("step3P1"), t("step3P2"), t("step3P3")],
      shot: <ShotEvent t={t} />,
    },
  ];

  // Scroll-driven: activate whichever step sits closest to the viewport centre.
  // (More reliable than a thin IntersectionObserver band across tall steps.)
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDist = Infinity;
      stepRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // Fit the phone to short viewports so it never clips.
    const onResize = () => {
      setPhoneScale(
        Math.max(0.62, Math.min(1, (window.innerHeight - 130) / 660)),
      );
    };
    onResize();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section
      id="kaip-veikia"
      className="nr-container scroll-mt-24 py-16 md:py-24"
    >
      <Reveal className="mx-auto mb-4 max-w-[640px] text-center md:mb-8">
        <span className="nr-badge nr-badge-tint mb-3.5">{t("badge")}</span>
        <h2 className="nr-h2 text-[30px] md:text-[44px]">{t("title")}</h2>
      </Reveal>

      {/* Desktop: sticky scrollytelling — phone pinned, text scrolls */}
      <div className="hidden md:grid md:grid-cols-[1fr_360px] md:gap-16 lg:gap-20">
        <div>
          {steps.map((step, i) => (
            <div
              key={step.overline}
              data-step={i}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className="flex min-h-[80vh] flex-col justify-center"
            >
              <StepText {...step} dim={active !== i} />
            </div>
          ))}
          {/* runway so the pinned phone stays centred through the last step */}
          <div aria-hidden className="h-[24vh]" />
        </div>

        <div className="relative">
          <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center gap-5">
            <div
              className="flex flex-col items-center gap-5"
              style={{
                transform: `scale(${phoneScale})`,
                transformOrigin: "center",
              }}
            >
              <div className="relative h-[600px] w-[300px]">
                {steps.map((step, i) => (
                  <div
                    key={step.overline}
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                      opacity: active === i ? 1 : 0,
                      transform:
                        active === i ? "none" : "translateY(14px) scale(.985)",
                      pointerEvents: active === i ? "auto" : "none",
                    }}
                    aria-hidden={active !== i}
                  >
                    <Phone>{step.shot}</Phone>
                  </div>
                ))}
              </div>
              {/* progress dots */}
              <div className="flex gap-2.5">
                {steps.map((step, i) => (
                  <span
                    key={step.overline}
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: active === i ? 30 : 8,
                      background: active === i ? "var(--nr-yellow)" : "#e6ddc9",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: stacked steps, each with its own phone */}
      <div className="flex flex-col gap-16 md:hidden">
        {steps.map((step) => (
          <Reveal key={step.overline}>
            <StepText {...step} />
            <div className="mt-8 flex justify-center">
              <Phone>{step.shot}</Phone>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
