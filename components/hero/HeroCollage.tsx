"use client";

import { useEffect, useRef } from "react";

type Img = { src: string; h: number; price?: string };
type Column = {
  drift: "up" | "down";
  speed: number; // vertical parallax rate
  speedX: number; // horizontal parallax rate
  className: string;
  images: Img[];
};

const COLUMNS: Column[] = [
  {
    drift: "up",
    speed: -0.16,
    speedX: -0.05,
    className: "",
    images: [
      { src: "/assets/images/examples/kids1.png", h: 250, price: "24 €" },
      { src: "/assets/images/examples/house2.png", h: 190 },
      { src: "/assets/images/examples/music1.png", h: 230, price: "59 €" },
    ],
  },
  {
    drift: "down",
    speed: -0.09,
    speedX: -0.025,
    className: "-mt-8",
    images: [
      { src: "/assets/images/examples/sports1.png", h: 200 },
      { src: "/assets/images/examples/pets2.png", h: 280, price: "39 €" },
      { src: "/assets/images/examples/activity1.png", h: 210 },
    ],
  },
  {
    drift: "up",
    speed: -0.22,
    speedX: 0,
    className: "hidden sm:block",
    images: [
      { src: "/assets/images/examples/house1.png", h: 270, price: "129 €" },
      { src: "/assets/images/examples/kids3.png", h: 190 },
      { src: "/assets/images/examples/sports3.png", h: 240, price: "89 €" },
    ],
  },
  {
    drift: "down",
    speed: -0.13,
    speedX: 0.025,
    className: "-mt-6 hidden md:block",
    images: [
      { src: "/assets/images/examples/music3.png", h: 200 },
      { src: "/assets/images/examples/pets1.png", h: 220, price: "18 €" },
      { src: "/assets/images/examples/activity3.png", h: 260 },
    ],
  },
  {
    drift: "up",
    speed: -0.19,
    speedX: 0.05,
    className: "hidden lg:block",
    images: [
      { src: "/assets/images/examples/house3.png", h: 230 },
      { src: "/assets/images/examples/kids2.png", h: 200, price: "34 €" },
      { src: "/assets/images/examples/sports2.png", h: 250 },
    ],
  },
];

function WishImage({ img }: { img: Img }) {
  return (
    <div className="group relative overflow-hidden rounded-[18px]">
      <img
        src={img.src}
        alt=""
        loading="lazy"
        className="block w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        style={{ height: img.h }}
      />
      {/* saved-wish heart */}
      <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-[13px] shadow-[0_2px_8px_rgba(35,31,24,0.12)] backdrop-blur-sm">
        💛
      </span>
      {/* price tag on a few */}
      {img.price && (
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-bold text-(--nr-ink) shadow-[0_2px_8px_rgba(35,31,24,0.12)] backdrop-blur-sm">
          {img.price}
        </span>
      )}
    </div>
  );
}

/**
 * Hero photo wall — an ambient collage of "saved wishes" with scroll parallax:
 * columns drift up at different rates as the page scrolls, so the wall gently
 * lifts away. Ambient CSS drift stays layered underneath. Respects reduced motion.
 */
export function HeroCollage({
  chipAdded,
  chipReserved,
}: {
  chipAdded: string;
  chipReserved: string;
}) {
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      colRefs.current.forEach((el, i) => {
        if (el)
          el.style.transform = `translate3d(${y * COLUMNS[i].speedX}px, ${
            y * COLUMNS[i].speed
          }px, 0)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative mt-11 h-[460px] overflow-hidden md:h-[560px]">
      <div
        className="nr-anim-fadeup flex gap-3 px-4 sm:gap-4 sm:px-6 md:px-10"
        style={{ animationDelay: "0.45s" }}
      >
        {COLUMNS.map((col, i) => (
          <div
            key={i}
            ref={(el) => {
              colRefs.current[i] = el;
            }}
            className={`flex-1 will-change-transform ${col.className}`}
          >
            <div
              className="flex flex-col gap-4"
              style={{
                animation: `${col.drift === "up" ? "nrDrift" : "nrDriftDn"} ${
                  col.drift === "up" ? 16 : 18
                }s ease-in-out infinite`,
              }}
            >
              {col.images.map((img) => (
                <WishImage key={img.src} img={img} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* fade into cream */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-b from-transparent to-(--nr-cream)" />

      {/* floating notification chips */}
      <div
        className="absolute left-4 top-24 flex items-center gap-2.5 rounded-[14px] bg-white px-4 py-3 text-sm font-semibold shadow-[var(--nr-shadow-float)] md:left-[12%]"
        style={{ animation: "nrBobL 6s ease-in-out infinite" }}
      >
        🐣 {chipAdded}
      </div>
      <div
        className="absolute right-4 top-56 flex items-center gap-2.5 rounded-[14px] bg-white px-4 py-3 text-sm font-semibold shadow-[var(--nr-shadow-float)] md:right-[11%]"
        style={{ animation: "nrBobR 7s ease-in-out 1.2s infinite" }}
      >
        💛 {chipReserved}
      </div>
    </div>
  );
}
