import { isChristmasSeason } from "@/lib/season";

/**
 * Subtle seasonal snow: a handful of small flakes drifting down behind
 * nothing interactive. Pure CSS (transform + opacity on the compositor), so
 * unlike the old framer-motion Snowfall (80 animated spans, laggy lobby) it
 * costs no JavaScript per frame. Hidden for prefers-reduced-motion, and fewer
 * flakes on phones. Positions are fixed numbers, not Math.random(), so server
 * and client render the same markup.
 */
const FLAKES = [
  [4, 9, 17, 0], [11, 6, 23, -6], [18, 12, 19, -12], [26, 7, 26, -3],
  [33, 10, 21, -15], [41, 6, 24, -9], [48, 13, 18, -1], [56, 8, 27, -18],
  [63, 11, 20, -7], [71, 6, 25, -13], [78, 9, 22, -4], [86, 12, 19, -16],
  [93, 7, 28, -10], [8, 8, 30, -20], [52, 9, 29, -22], [89, 6, 31, -25],
] as const; // [left %, size px, seconds, delay s]

export function Snowflakes() {
  if (!isChristmasSeason()) return null;
  return (
    <div aria-hidden className="nr-snow pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {FLAKES.map(([left, size, dur, delay], i) => (
        <span
          key={i}
          className={i % 2 ? "nr-flake max-md:hidden" : "nr-flake"}
          style={{
            left: `${left}%`,
            fontSize: size,
            animationDuration: `${dur}s, ${dur / 3}s`,
            animationDelay: `${delay}s, ${delay}s`,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}
