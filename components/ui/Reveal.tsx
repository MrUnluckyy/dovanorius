"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/**
 * Subtle scroll-triggered reveal (fade + rise) using IntersectionObserver.
 * Part of the Noriuto design system. Honours prefers-reduced-motion and
 * degrades to visible content if JS/observer is unavailable.
 *
 * `delay` staggers siblings (ms). `as` picks the wrapper element.
 */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
  amount = 0.15,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  amount?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce || !("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: amount, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount]);

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(16px)",
        transition:
          "opacity .7s var(--nr-ease-out-expo), transform .7s var(--nr-ease-out-expo)",
        transitionDelay: `${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}
