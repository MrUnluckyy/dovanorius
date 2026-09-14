import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Platform } from "@/lib/device";

export const IOS_URL = "https://apps.apple.com/lt/app/noriuto/id6755694255";
export const PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.justassobutas.noriutoapp";

/** Apple's mark, single-colour so it inherits whichever half it sits in. */
export function AppleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M17.05 12.54c-.02-2.02 1.65-2.99 1.72-3.04-.94-1.37-2.4-1.56-2.92-1.58-1.24-.13-2.42.73-3.05.73-.63 0-1.6-.71-2.63-.69-1.35.02-2.6.79-3.29 2-1.4 2.43-.36 6.03 1 8.01.67.97 1.46 2.05 2.5 2.01 1-.04 1.38-.65 2.6-.65 1.2 0 1.55.65 2.6.63 1.08-.02 1.76-.98 2.42-1.96.76-1.12 1.08-2.21 1.09-2.27-.02-.01-2.09-.8-2.11-3.18zM15.1 6.44c.55-.67.92-1.6.82-2.53-.79.03-1.75.53-2.32 1.19-.51.59-.96 1.53-.84 2.44.88.07 1.78-.45 2.34-1.1z" />
    </svg>
  );
}

/**
 * Play's triangle, kept in its own four colours.
 *
 * It is the only off-brand colour on the page, and that is the point: it is
 * the mark people's eyes hunt for, and a cream-and-yellow repaint of it would
 * cost the recognition the whole row is trading on.
 */
export function PlayGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        fill="#00E676"
        d="M99.617 8.057a50.191 50.191 0 0 0-38.815-6.713l230.932 230.933 74.846-74.846L99.617 8.057z"
      />
      <path
        fill="#00A0FF"
        d="M32.139 20.116c-6.441 8.563-10.148 19.077-10.148 30.199v411.358c0 11.123 3.708 21.636 10.148 30.199l235.877-235.877L32.139 20.116z"
      />
      <path
        fill="#FFCE00"
        d="M464.261 212.087l-67.266-37.637-81.544 81.544 81.548 81.548 67.273-37.64c16.117-9.03 25.738-25.442 25.738-43.908s-9.621-34.877-25.749-43.907z"
      />
      <path
        fill="#FF3A44"
        d="M291.733 279.711L60.815 510.629c3.786.891 7.639 1.371 11.492 1.371a50.275 50.275 0 0 0 27.31-8.07l266.965-149.372-74.849-74.847z"
      />
    </svg>
  );
}

/**
 * One app, two doors.
 *
 * Both stores live inside a single pill split by a hairline rather than
 * standing as two separate badges — the app is one thing, and two competing
 * black rectangles under the hero say the opposite while fighting the cream
 * and yellow everything else is built from.
 *
 * `platform` comes from the request user-agent (see lib/device.ts): on a phone
 * the store that visitor can actually install from is filled in, so the tap
 * target is already picked out and the divider is dropped — the choice has
 * been made for them. On desktop both halves stay level.
 *
 * `tone` is the surface underneath: "cream" for the page, "yellow" for the
 * pre-footer block, where the filled half goes ink rather than yellow-on-yellow.
 */
export function StoreLinks({
  platform = null,
  tone = "cream",
  className = "",
}: {
  platform?: Platform;
  tone?: "cream" | "yellow";
  className?: string;
}) {
  const t = useTranslations("Landing.stores");

  const filled =
    tone === "yellow"
      ? "bg-(--nr-ink) text-white"
      : "bg-(--nr-yellow) text-(--nr-ink)";
  const idle = "text-(--nr-ink) hover:bg-(--nr-tile)";

  const half = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 transition-colors sm:gap-2.5 sm:px-3.5 ${
      active ? filled : idle
    }`;

  const eyebrow = (active: boolean) =>
    `block whitespace-nowrap text-[10px] font-semibold leading-tight ${
      active && tone === "yellow"
        ? "text-white/70"
        : active
          ? "text-(--nr-ink)/65"
          : "text-(--nr-gold-text)"
    }`;

  return (
    <div
      className={`inline-flex items-stretch rounded-full border border-(--nr-border) bg-white p-1.5 shadow-[0_2px_10px_rgba(35,31,24,0.05)] ${className}`}
    >
      <Link
        href={IOS_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("iosAria")}
        className={half(platform === "ios")}
      >
        <AppleGlyph />
        <span className="text-left">
          <span className={eyebrow(platform === "ios")}>{t("iosEyebrow")}</span>
          <span className="block whitespace-nowrap text-[14px] font-bold leading-tight">
            {t("ios")}
          </span>
        </span>
      </Link>

      {/* Dropped once a half is filled: a rule between a lit door and a dark
          one separates nothing that colour has not separated already. */}
      {platform === null && (
        <span aria-hidden="true" className="my-2 w-px bg-(--nr-border)" />
      )}

      <Link
        href={PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("androidAria")}
        className={half(platform === "android")}
      >
        <PlayGlyph />
        <span className="text-left">
          <span className={eyebrow(platform === "android")}>
            {t("androidEyebrow")}
          </span>
          <span className="block whitespace-nowrap text-[14px] font-bold leading-tight">
            {t("android")}
          </span>
        </span>
      </Link>
    </div>
  );
}
