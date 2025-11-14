"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Flake = {
  id: number;
  size: number;
  left: number;
  duration: number;
  delay: number;
  opacity: number;
};

const FLAKE_COUNT = 80;

export function Snowfall() {
  const [flakes, setFlakes] = useState<Flake[]>([]);

  useEffect(() => {
    const generated: Flake[] = Array.from({ length: FLAKE_COUNT }, (_, i) => ({
      id: i,
      size: Math.random() * 8 + 4, // 4–12px
      left: Math.random() * 100, // 0–100vw
      duration: Math.random() * 8 + 10, // 10–18s
      delay: Math.random() * -20, // negative delay = already falling
      opacity: Math.random() * 0.5 + 0.3, // 0.3–0.8
    }));
    setFlakes(generated);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {flakes.map((flake) => (
        <motion.span
          key={flake.id}
          initial={{ y: "-10vh" }}
          animate={{
            y: "110vh",
            x: ["0vw", "8vw", "-4vw", "0vw"], // small drift
          }}
          transition={{
            duration: flake.duration,
            delay: flake.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute rounded-full bg-base-100/80 shadow-sm"
          style={{
            width: flake.size,
            height: flake.size,
            left: `${flake.left}%`,
            opacity: flake.opacity,
          }}
        />
      ))}
    </div>
  );
}
