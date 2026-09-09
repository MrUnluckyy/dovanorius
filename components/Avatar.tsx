import { LuUser } from "react-icons/lu";

/**
 * A person, at any size.
 *
 * Two things were wrong here. The placeholder for someone with no name and no
 * picture read literally "USR" — a truncation of a word, in a slot where every
 * other state shows either a face or a letter. And the size prop never worked:
 * `w-${size}` is assembled at runtime, so Tailwind — which finds classes by
 * scanning source text — never generated `w-10` or `w-40` from it. Avatars were
 * whatever size they happened to inherit, and the callers passing size={4} and
 * size={10} were getting the same result.
 *
 * `size` keeps its old meaning (a Tailwind spacing step, so size={10} is the
 * 2.5rem that `w-10` would have been) but is applied as a real dimension. Sizes
 * therefore change on screen wherever a caller was relying on the accidental
 * default.
 */
export function Avatar({
  avatar_url,
  name,
  size = 24,
}: {
  avatar_url?: string | null;
  /** Shown as an initial when there is no picture. */
  name?: string | null;
  /** Tailwind spacing step: the rendered box is `size * 0.25rem` square. */
  size?: number;
}) {
  const box = `${size * 0.25}rem`;
  // The glyph and the initial both key off the box rather than a fixed step, so
  // a 1rem avatar and a 10rem one stay in proportion instead of one of them
  // overflowing.
  const inner = { width: box, height: box };

  if (avatar_url) {
    return (
      <div className="avatar shrink-0">
        <div className="rounded-full" style={inner}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatar_url}
            alt={name ? `${name}` : "Avatar"}
            className="h-full w-full rounded-full object-cover"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="avatar avatar-placeholder shrink-0">
      <div
        className="grid place-items-center rounded-full bg-neutral text-neutral-content"
        style={inner}
        // The initial is decoration next to a name that is almost always
        // rendered beside it; the glyph fallback carries the meaning instead.
        aria-hidden={name ? true : undefined}
        role={name ? undefined : "img"}
        aria-label={name ? undefined : "Avatar"}
      >
        {name ? (
          <span
            className="font-medium leading-none"
            style={{ fontSize: `calc(${box} * 0.45)` }}
          >
            {name.trim().charAt(0).toUpperCase()}
          </span>
        ) : (
          <LuUser style={{ width: `calc(${box} * 0.55)`, height: "auto" }} />
        )}
      </div>
    </div>
  );
}
