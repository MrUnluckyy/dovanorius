"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { FaRegThumbsUp } from "react-icons/fa6";

type Testimonial = {
  name: string;
  imageUrl: string;
  quote: string;
};

export function TestimonialsCarousel({
  items,
  recommend,
}: {
  items: Testimonial[];
  recommend: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const SPEED = 0.09; // px per ms

    const tick = (time: number) => {
      if (!pausedRef.current && lastTimeRef.current) {
        const delta = time - lastTimeRef.current;
        el.scrollLeft += SPEED * delta;

        // Seamless loop — items are duplicated so reset at the halfway point
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft = 0;
        }
      }
      lastTimeRef.current = time;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const pause = () => { pausedRef.current = true; };
    const resume = () => {
      lastTimeRef.current = 0; // reset so no jump on resume
      pausedRef.current = false;
    };

    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resume, { passive: true });
    el.addEventListener("mousedown", pause);
    el.addEventListener("mouseup", resume);
    el.addEventListener("mouseleave", resume);

    return () => {
      cancelAnimationFrame(rafRef.current);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
      el.removeEventListener("mousedown", pause);
      el.removeEventListener("mouseup", resume);
      el.removeEventListener("mouseleave", resume);
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto scrollbar-hide flex gap-4 px-4 pb-2 cursor-grab active:cursor-grabbing select-none"
      style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
    >
      {items.map((testimonial, i) => (
        <div key={`${testimonial.name}-${i}`} className="shrink-0 w-72">
          <div className="card card-border shadow bg-base-100 h-full">
            <div className="card-body">
              <div className="flex gap-2 items-center text-sm text-accent font-semibold">
                <FaRegThumbsUp size={18} />
                <span>{recommend}</span>
              </div>
              <p className="mb-4 text-sm">{testimonial.quote}</p>
              <div className="flex items-center gap-2 mt-auto">
                <div className="avatar">
                  <div className="w-8 rounded-full">
                    <Image
                      src={testimonial.imageUrl}
                      alt={testimonial.name}
                      width={48}
                      height={48}
                    />
                  </div>
                </div>
                <span className="font-bold text-sm">{testimonial.name}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
