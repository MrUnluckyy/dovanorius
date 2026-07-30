import Link from "next/link";

const IOS_URL = "https://apps.apple.com/lt/app/noriuto/id6755694255";

/** Pill-style App Store button matching the Noriuto design system. */
export function AppStoreButton({
  className = "",
  label = "App Store",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href={IOS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={label}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M17.05 12.54c-.02-2.02 1.65-2.99 1.72-3.04-.94-1.37-2.4-1.56-2.92-1.58-1.24-.13-2.42.73-3.05.73-.63 0-1.6-.71-2.63-.69-1.35.02-2.6.79-3.29 2-1.4 2.43-.36 6.03 1 8.01.67.97 1.46 2.05 2.5 2.01 1-.04 1.38-.65 2.6-.65 1.2 0 1.55.65 2.6.63 1.08-.02 1.76-.98 2.42-1.96.76-1.12 1.08-2.21 1.09-2.27-.02-.01-2.09-.8-2.11-3.18zM15.1 6.44c.55-.67.92-1.6.82-2.53-.79.03-1.75.53-2.32 1.19-.51.59-.96 1.53-.84 2.44.88.07 1.78-.45 2.34-1.1z" />
      </svg>
      {label}
    </Link>
  );
}
