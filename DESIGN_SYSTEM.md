# Noriuto Design System

Warm, friendly wishlist brand. Cream page + white cards + **one** yellow accent,
warm near-black ink. Derived from the 2026 landing redesign. This is the single
source of truth for the brand look — reuse it when bringing the rest of the app
(dashboard, boards, events, auth) up to the same standard.

## Where it lives

- **Tokens + DaisyUI theme + primitives:** `app/globals.css`
  - `@plugin "daisyui/theme" { name: "noriuto" … }` — maps the brand palette onto
    DaisyUI, so every `btn` / `card` / `badge` / `input` in the app inherits it.
  - `:root { --nr-* }` — raw design tokens (palette, radii, shadows, motion).
  - `@layer components { .nr-* }` — reusable primitive classes.
- **Fonts:** `app/layout.tsx` — Bricolage Grotesque (`--font-heading`, display) +
  Instrument Sans (`--font-body`, UI/body).
- **Reference landing implementation:** `app/page.tsx` and `components/landing/*`,
  `components/hero/ImageHero.tsx`.

## Foundations

| Token group | Values |
| --- | --- |
| Page / surface | `--nr-cream #faf7f0` · `--nr-surface #fff` · `--nr-tile #fff4d6` |
| Ink / text | `--nr-ink #231f18` · `--nr-muted #6b6357` · `--nr-faint #8f8779` |
| Accent | `--nr-yellow #ffd166` (hover `#ffc94d`, deep `#e0b23f`) |
| Border | `--nr-border #eee5d4` (1px hairlines only) |
| Radii | pills `999px`, cards `24px`, media `18px`, chips/inputs `14px` |
| Shadows | rare + soft; yellow buttons use a 2px pressed edge, not a blur |
| Motion | reveals fade-up 16px · buttons lift −2px · cards lift −3px · ambient drift |

Type: hero 68px desktop / 40px mobile, Bricolage 800 with tight negative tracking.
Tone: Lithuanian, informal "tu", warm, sentence case, emoji as small friendly icons.

## Primitives (use these instead of re-styling from scratch)

```
.nr-container   max 1180px, responsive gutters
.nr-section     vertical section rhythm (70px desktop)
.nr-display / .nr-h2 / .nr-h3 / .nr-lead / .nr-overline   typography
.nr-btn + .nr-btn-primary | .nr-btn-dark | .nr-btn-outline  (+ .nr-btn-sm)
.nr-card (+ .nr-card-hover)   white card with hairline
.nr-tile        soft-yellow tile
.nr-badge + .nr-badge-solid | .nr-badge-tint | .nr-badge-outline
.nr-anim-fadeup, .nr-marquee, .nr-marquee-mask   motion helpers
```

Prefer DaisyUI classes (`btn btn-primary`, `card`, `badge`) for standard app UI —
they now render in the brand palette automatically. Reach for `.nr-*` when you need
the exact marketing-grade look (pill buttons with pressed edge, drift/marquee, etc.).

## Using CSS variables in Tailwind (v4)

This project is on Tailwind v4 — reference tokens with the **parenthesis** syntax:

```
bg-(--nr-cream)  text-(--nr-muted)  border-(--nr-border)
```

The old v3 `bg-[--nr-cream]` bracket shorthand does **not** work in v4.

## Applying to the rest of the app (next step)

1. Swap ad-hoc greys/yellows for tokens or DaisyUI semantic colors.
2. Replace bespoke buttons with `btn`/`.nr-btn`, bespoke cards with `card`/`.nr-card`.
3. Use `.nr-container` + `.nr-section` for page scaffolding and rhythm.
4. Keep to one accent (yellow), 1px hairlines, generous radii, soft/rare shadows.

## Motion primitives

- **`components/ui/Reveal.tsx`** — subtle scroll-triggered fade+rise via
  IntersectionObserver. Wrap any block: `<Reveal delay={90}>…</Reveal>`. Honours
  `prefers-reduced-motion` and degrades to visible. Used across the landing sections.
- **Sticky scrollytelling** (`components/landing/HowItWorks.tsx`): the phone is
  `position: sticky` and stays pinned while the three step texts scroll past; an
  IntersectionObserver (`rootMargin: -45% 0 -45%`) tracks the centred step and
  cross-fades the phone screen + progress dots. Mobile falls back to stacked steps.
  ⚠️ **Do not put `overflow-hidden` on an ancestor of a sticky section** — it silently
  breaks `position: sticky`. `app/page.tsx` `<main>` is intentionally not clipped;
  sections that need clipping (hero collage, marquee) clip themselves.

## Internationalisation

- All landing copy lives under the **`Landing`** namespace in `messages/lt.json` +
  `messages/en.json` (`Landing.nav`, `.hero`, `.features`, `.how`, `.tiles`,
  `.testimonials`, `.cta`, `.footer`). Server components use `getTranslations`,
  client components (`LandingHeader`, `HowItWorks`) use `useTranslations`.
- Language picker: `components/LocaleSwitcher.tsx` (flag `<select>` → `setLocale`
  server action → cookie), placed in `LandingHeader`.

## Notes / follow-ups

- The DaisyUI `noriuto` theme change is app-wide; other pages now pick up the cream
  palette. Review high-traffic app screens (dashboard, boards) and align them next.
- Guest user-search on the landing is a search **icon** in `LandingHeader` that opens
  the existing `NavSearch` full-screen overlay (`NavSearch` gained a `trigger="icon"`
  prop). The always-visible input variant is still used inside the app nav.
- Legacy landing components no longer used by `app/page.tsx`
  (`Examples.tsx`, `TestimonialsCarousel.tsx`, `AppStoreBadge.tsx`) are left in place;
  remove once nothing references them.
