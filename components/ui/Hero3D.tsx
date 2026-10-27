/**
 * 3D illustrations from Microsoft's Fluent Emoji (MIT, see
 * public/assets/illustrations/3d/LICENSE) — the same set and names the mobile
 * app's Hero3D uses, so an empty state looks the same on both. 256px sources:
 * crisp up to ~128px on a 2x screen.
 *
 * Pops in, then floats slowly over a soft shadow so it reads as an object
 * rather than a flat icon. `still` drops the motion for small spots (a card's
 * icon) where it would distract. Motion is CSS-only and switched off under
 * prefers-reduced-motion (see .nr-hero3d in globals.css).
 */
export const HERO3D_NAMES = [
  "gift",
  "wave",
  "envelope",
  "memo",
  "archive",
  "star",
  "calendar",
  "party",
  "hourglass",
  "bulb",
  "friends",
  "trophy",
] as const;

export type Hero3DName = (typeof HERO3D_NAMES)[number];

export function Hero3D({
  name,
  size = 88,
  still = false,
  className = "",
}: {
  name: Hero3DName;
  size?: number;
  still?: boolean;
  className?: string;
}) {
  const img = (
    // A fixed local PNG at a known size: next/image would only add a wrapper.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/assets/illustrations/3d/${name}.png`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
      className="select-none"
    />
  );

  if (still) {
    return <span className={`inline-block shrink-0 ${className}`}>{img}</span>;
  }

  return (
    <span
      className={`nr-hero3d relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size + 8 }}
    >
      <span className="nr-hero3d-object block">{img}</span>
      <span
        className="nr-hero3d-shadow absolute bottom-0 h-1.5 rounded-full bg-black"
        style={{ width: size * 0.5, left: size * 0.25 }}
      />
    </span>
  );
}
