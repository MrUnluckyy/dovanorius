"use client";
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

// =============================
// ConfettiBurst Component
// =============================
export type ConfettiBurstProps = {
  /** When this value changes, a new burst is spawned */
  burstKey?: string | number;
  /** Number of particles */
  count?: number;
  /** Hex or CSS color strings */
  colors?: string[];
  /** Degrees of spread (0-360). 90–140 feels nice for top explosions */
  spread?: number;
  /** Base speed in px; will be randomized per particle */
  velocity?: number;
  /** How strong gravity pulls particles down (px/s^2 approximation) */
  gravity?: number;
  /** Randomness factor 0..1; higher = more chaos */
  randomness?: number;
  /** Where to start, relative to container (0..1) */
  origin?: { x: number; y: number };
  /** Lifetime of particles in seconds */
  duration?: number;
  /** Render above content */
  zIndex?: number;
  /** Optional className for container */
  className?: string;
};

const DEFAULT_COLORS = [
  "#FFD166", // warm yellow
  "#EF476F", // pink/red
  "#06D6A0", // teal
  "#118AB2", // blue
  "#8338EC", // purple
];

// Helper to get a random number in range
const rnd = (min: number, max: number) => Math.random() * (max - min) + min;

// Generate particle config once per burst
function useParticles(
  count: number,
  opts: Required<
    Pick<
      ConfettiBurstProps,
      | "spread"
      | "velocity"
      | "gravity"
      | "randomness"
      | "origin"
      | "colors"
      | "duration"
    >
  >
) {
  const { spread, velocity, gravity, randomness, origin, colors, duration } =
    opts;
  return useMemo(() => {
    const particles = Array.from({ length: count }).map((_, i) => {
      // Angle: center upwards (-90deg) with spread
      const centerAngle = -90; // upwards
      const half = spread / 2;
      const angle = centerAngle + rnd(-half, half);
      const angleRad = (angle * Math.PI) / 180;

      // Speed randomized around base velocity
      const speed = velocity * (0.5 + Math.random() * 0.75); // 50%..125%

      // Initial velocity components
      const vx = Math.cos(angleRad) * speed;
      const vy = Math.sin(angleRad) * speed; // negative is up

      // End position approximation after duration with constant acceleration (gravity)
      // s = v*t + 0.5*a*t^2
      const t = duration; // seconds
      const endX = vx * t;
      const endY = vy * t + 0.5 * gravity * t * t;

      const spin = rnd(-720, 720);
      const tilt = rnd(-25, 25);
      const size = rnd(6, 12);
      const color = colors[i % colors.length];

      // Chaotic keyframes by adding small random offsets
      const chaos = randomness * 80; // px wiggle amplitude
      const midX = endX * 0.6 + rnd(-chaos, chaos);
      const midY = endY * 0.6 + rnd(-chaos, chaos);

      return {
        id: `${Date.now()}-${i}-${Math.round(Math.random() * 1e6)}`,
        color,
        size,
        origin,
        rotate: spin,
        tilt,
        keyframes: {
          x: [0, midX, endX],
          y: [0, midY, endY],
          scale: [1, 1, rnd(0.7, 1)],
          opacity: [1, 1, 0],
        },
      };
    });
    return particles;
  }, [
    count,
    spread,
    velocity,
    gravity,
    randomness,
    origin.x,
    origin.y,
    colors,
    duration,
  ]);
}

export function ConfettiBurst({
  burstKey,
  count = 120,
  colors = DEFAULT_COLORS,
  spread = 120,
  velocity = 450, // px per second
  gravity = 800, // px per second^2
  randomness = 0.4,
  origin = { x: 0.5, y: 0.4 },
  duration = 1.1, // seconds
  zIndex = 50,
  className,
}: ConfettiBurstProps) {
  const particles = useParticles(count, {
    spread,
    velocity,
    gravity,
    randomness,
    origin,
    colors,
    duration,
  });

  return (
    <div
      key={String(burstKey)}
      className={`pointer-events-none absolute inset-0 ${className ?? ""}`}
      style={{ zIndex }}
      aria-hidden
    >
      {/* Origin anchor */}
      <div
        className="absolute"
        style={{ left: `${origin.x * 100}%`, top: `${origin.y * 100}%` }}
      >
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{
              x: 0,
              y: 0,
              opacity: 0,
              rotate: p.tilt,
            }}
            animate={{
              x: p.keyframes.x,
              y: p.keyframes.y,
              rotate: [p.tilt, p.rotate],
              opacity: p.keyframes.opacity,
              scale: p.keyframes.scale,
            }}
            transition={{
              duration,
              ease: [0.2, 0.7, 0.2, 1],
            }}
            className="block absolute will-change-transform"
            // style={{
            //   width: p.size,
            //   height: p.size * 0.6,
            //   background: p.color,
            //   borderRadius: 2,
            //   transformOrigin: "center",
            // }}
          >
            🎁
          </motion.span>
        ))}
      </div>
    </div>
  );
}

// =============================
// Demo component
// =============================
export default function ConfettiDemo() {
  const [key, setKey] = useState(0);
  return (
    <div className="min-h-[60vh] grid place-items-center bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="relative w-full max-w-xl">
        {/* Confetti overlay */}
        <ConfettiBurst burstKey={key} />

        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl p-8 border border-slate-100">
          <h1 className="text-2xl font-bold tracking-tight">
            Framer Motion Confetti
          </h1>
          <p className="text-slate-600 mt-2">
            Click the button to spawn a colourful confetti burst. Customize
            count, colors, spread, gravity, and more.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setKey((k) => k + 1)}
              className="px-4 py-2 rounded-2xl bg-black text-white hover:opacity-90 transition"
            >
              Celebrate 🎉
            </button>
            <button
              onClick={() => setKey((k) => k + 1)}
              className="px-4 py-2 rounded-2xl border border-slate-300 hover:bg-slate-50"
            >
              Again
            </button>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Tip: Place{" "}
            <code className="bg-slate-100 px-1 rounded">
              &lt;ConfettiBurst /&gt;
            </code>{" "}
            inside a <code className="bg-slate-100 px-1 rounded">relative</code>{" "}
            container so it can absolutely position.
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================
// Quick usage (copy/paste)
// =============================
// 1) npm i framer-motion
// 2) Ensure the parent container has className="relative"
// 3) Trigger by changing the `burstKey` prop (e.g., increment a number)
