/**
 * Posts without a cover image used to render as blank white boxes. Rather than
 * a shared grey placeholder, derive a stable gradient from the slug so every
 * post looks deliberate and is distinguishable at a glance.
 *
 * Hues stay inside the site's warm range and the second stop is a near
 * neighbour of the first — two random hues produced clashing candy gradients.
 */
// 70–110 is skipped deliberately: those land on olive/khaki, which reads muddy.
const HUES = [20, 36, 52, 152, 260, 340];

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function CoverFallback({
  seed,
  label,
  className = "",
}: {
  seed: string;
  label?: string | null;
  className?: string;
}) {
  const hash = hashString(seed);
  const hue = HUES[hash % HUES.length];
  const hue2 = hue + (hash % 2 === 0 ? 18 : -18);
  const angle = 135 + (hash % 60);

  const initial = label?.trim()?.[0]?.toUpperCase() ?? "•";

  return (
    <div
      aria-hidden
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{
        backgroundImage: `linear-gradient(${angle}deg, oklch(93% 0.05 ${hue}), oklch(80% 0.09 ${hue2}))`,
      }}
    >
      {/* Soft off-centre bloom for depth. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle at ${
            28 + (hash % 44)
          }% 26%, oklch(99% 0.02 ${hue} / 0.7), transparent 62%)`,
        }}
      />
      <span className="font-heading relative text-7xl font-bold text-white/60 select-none">
        {initial}
      </span>
    </div>
  );
}
