import Link from "next/link";

const IOS_URL = "https://apps.apple.com/lt/app/noriuto/id6755694255";

export function AppStoreBadge({ className }: { className?: string }) {
  return (
    <Link
      href={IOS_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="Parsisiųsti iš App Store"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 120 40"
        width="150"
        height="50"
        role="img"
        aria-label="Download on the App Store"
        className="hover:opacity-80 transition-opacity"
      >
        {/* Badge background */}
        <rect width="120" height="40" rx="7" ry="7" fill="#000" />
        <rect
          x="0.5"
          y="0.5"
          width="119"
          height="39"
          rx="6.5"
          ry="6.5"
          fill="none"
          stroke="#a6a6a6"
          strokeWidth="0.5"
        />

        {/* Apple logo */}
        <path
          d="M24.77 20.3a4.93 4.93 0 0 1 2.35-4.14 5.05 5.05 0 0 0-3.98-2.15c-1.68-.18-3.3 1-4.15 1s-2.19-1-3.6-1a5.29 5.29 0 0 0-4.45 2.71c-1.9 3.3-.49 8.17 1.35 10.84.9 1.3 1.97 2.75 3.37 2.7s1.87-.87 3.51-.87 2.1.87 3.53.84 2.38-1.31 3.26-2.62a11 11 0 0 0 1.49-3.04 4.77 4.77 0 0 1-2.68-4.27z"
          fill="#fff"
        />
        <path
          d="M22.51 12.44a4.86 4.86 0 0 0 1.11-3.48 4.94 4.94 0 0 0-3.2 1.65 4.62 4.62 0 0 0-1.14 3.35 4.08 4.08 0 0 0 3.23-1.52z"
          fill="#fff"
        />

        {/* "Download on the" text */}
        <text
          x="38"
          y="14"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
          fontSize="8"
          fill="#fff"
          letterSpacing="0.1"
        >
          Download on the
        </text>

        {/* "App Store" text */}
        <text
          x="37"
          y="27"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif"
          fontSize="16"
          fontWeight="600"
          fill="#fff"
          letterSpacing="-0.3"
        >
          App Store
        </text>
      </svg>
    </Link>
  );
}
