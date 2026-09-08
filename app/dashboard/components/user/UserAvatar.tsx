import { LuUser } from "react-icons/lu";

/**
 * The signed-in user's own avatar.
 *
 * Same two faults as components/Avatar.tsx, fixed the same way: the empty state
 * spelled out the word "User" inside the circle, and `w-${size}` was assembled
 * at runtime so Tailwind never emitted the class — size="40" and size="30"
 * rendered identically. `size` keeps its Tailwind-step meaning and is applied
 * as a real dimension, so those two now differ on screen as they always read as
 * though they did.
 *
 * This has no `name`, so unlike the general Avatar it cannot fall back to an
 * initial; the glyph is the only placeholder available.
 */
export function UserAvatar({
  avatarUrl,
  size,
}: {
  avatarUrl?: string | null;
  /** Tailwind spacing step, as a string: "40" renders a 10rem circle. */
  size?: string;
}) {
  const step = Number(size) || 24;
  const box = `${step * 0.25}rem`;
  const inner = { width: box, height: box };

  if (avatarUrl) {
    return (
      <div className="avatar">
        <div className="rounded-full" style={inner}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt="User avatar"
            className="h-full w-full rounded-full object-cover"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="avatar avatar-placeholder">
      <div
        className="grid place-items-center rounded-full bg-neutral text-neutral-content"
        style={inner}
        role="img"
        aria-label="User avatar"
      >
        <LuUser style={{ width: `calc(${box} * 0.55)`, height: "auto" }} />
      </div>
    </div>
  );
}
