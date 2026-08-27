/**
 * Brand tokens for email, mirroring the `--nr-*` values in app/globals.css.
 *
 * Duplicated as plain hex on purpose: an email client has no CSS variables, no
 * stylesheet and no Tailwind, so every value has to be inlined at render time.
 * When the palette moves in globals.css, move it here too.
 *
 * The old templates were built before the rebrand and all used #31473A, a green
 * that no longer appears anywhere in the product.
 */
export const brand = {
  /** Page behind the card. */
  page: "#faf7f0",
  /** The card itself. */
  surface: "#ffffff",
  /** Soft yellow tile, for callout panels. */
  tile: "#fff4d6",
  /** Hairline borders and dividers. */
  border: "#eee5d4",

  /** Primary text, and the label on a yellow button. */
  ink: "#231f18",
  /** Secondary text. */
  muted: "#6b6357",
  /** Captions, footer, legal. */
  faint: "#8f8779",
  /** Small strong labels sitting on `tile`. */
  goldStrong: "#8a6d1f",

  /** The one accent: buttons and highlights. */
  yellow: "#ffd166",
  /** Pressed edge under a yellow button. */
  yellowDeep: "#e0b23f",
} as const;

export const font =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Yellow fill, ink label — the same primary/primary-content pairing the app
 * uses, and a far higher contrast than white-on-green ever was.
 */
export const buttonPrimary = {
  backgroundColor: brand.yellow,
  color: brand.ink,
  padding: "13px 24px",
  borderRadius: "999px",
  fontWeight: 700,
  fontSize: "15px",
  display: "inline-block",
  textDecoration: "none",
  borderBottom: `2px solid ${brand.yellowDeep}`,
} as const;

/** For the lesser of two actions; never the only button in a message. */
export const buttonSecondary = {
  backgroundColor: brand.surface,
  color: brand.ink,
  padding: "12px 24px",
  borderRadius: "999px",
  fontWeight: 600,
  fontSize: "15px",
  display: "inline-block",
  textDecoration: "none",
  border: `1px solid ${brand.border}`,
} as const;

export const text = {
  margin: "0 0 14px",
  fontSize: "16px",
  lineHeight: "1.6",
  color: brand.ink,
} as const;

export const textMuted = {
  ...text,
  fontSize: "14px",
  color: brand.muted,
} as const;
