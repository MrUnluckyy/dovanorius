# Task brief: editorial pick shelf, managed in /admin

**Status: BUILT 2026-08-13** on branch `fix/expose-garden-pets-categories`, not yet committed.
Migration applied to prod. All six checklist items below verified — see "How it was built".
**Prepared:** 2026-08-12. Verified against prod (`jnoqacjvhnkhegmjmpdv`) and master at that date.

---

## What is being asked for

A shelf on `/discover` whose products are **hand-picked in `/admin`** rather than chosen by
the weekly LLM curator, with a **schedule** — it appears and disappears on dates the curator
sets, without anyone deploying.

## Why the justification changed (read before scoping)

Originally requested when shelves were thin and hand-picking was a rescue. That reason is
gone: re-curation on 2026-08-12 left **zero shelves under 10 picks** (worst two went 9 → 22
and 9 → 17). So this is no longer a fix, it is **editorial control** — seasonal pushes
("Motinos dienai"), a partner spotlight, a themed set the LLM cannot infer.

That changes the priority, not the design. Worth confirming it is still wanted before
building it.

---

## What already exists (do not rebuild)

| Piece | Where | Note |
|---|---|---|
| Shelf storage | `gift_personas` + `persona_products` | already public-read |
| Shelf renderer | `app/discover/_components/PersonaShelf.tsx` | renders `kind='theme'` inline |
| Read hooks | `hooks/usePersonas.ts` | `usePersonas`, `usePersonaPicks`, `useShelfContinuation` |
| Weekly curator | `lib/personas/refresh.ts`, `scripts/refresh-personas.ts` | LLM; Mondays 06:30 UTC |
| Admin shell | `app/admin/layout.tsx`, `_components/AdminNav.tsx` | `profiles.is_admin` gate |
| Admin action pattern | `app/admin/partners/actions.ts` | `ActionResult<T>`, `requireAdminId()` |

`persona_products.reason` is **already rendered on the card**, so a hand-written "why this
one" line comes for free — no UI work needed for it.

### Schema as it stands

```
gift_personas(
  id uuid pk, slug text, label_lt text, label_en text,
  description text NOT NULL,          -- must be supplied on insert, no default
  gender text, age_min int, age_max int,
  product_types text[] NOT NULL '{}', include_keywords text[] NOT NULL '{}',
  exclude_keywords text[] NOT NULL '{}',
  price_min numeric NOT NULL 10, price_max numeric NOT NULL 300,
  examples text[] NOT NULL '{}',
  is_active bool NOT NULL true, sort_order int NOT NULL 100,
  kind text NOT NULL 'recipient'      -- 'recipient' | 'theme'
)

persona_products(
  persona_id uuid, product_id text, rank int, reason text, refreshed_at timestamptz,
  PRIMARY KEY (persona_id, product_id),
  persona_id → gift_personas ON DELETE CASCADE,
  product_id → inspo_products ON DELETE CASCADE   -- ⚠ see landmine 2
)
```

RLS today: `gift_personas` SELECT where `is_active`; `persona_products` SELECT `true`.

---

## ⚠ Landmines — all three fail silently

### 1. The weekly curator will wipe hand-picked rows

`scripts/refresh-personas.ts` selects **every active persona regardless of `kind`**:

```ts
.from("gift_personas").select("*").eq("is_active", true).order("sort_order")
```

and `refresh.ts` then does delete-then-insert on `persona_products`. Add an editorial shelf
as a new `kind` and **the next Monday run replaces the hand-picked set with LLM output**.
Nobody gets an error; the shelf just quietly becomes something else.

**Fix as part of this task:** exclude editorial in the selection query (`.neq("kind",
"editorial")`), and guard again inside `refreshPersona` so a `--slug` invocation cannot do
it either. Two layers, because the script accepts explicit slugs on the command line.

### 2. The nightly import can delete a pick out from under the curator

`product_id → inspo_products ON DELETE CASCADE`, and the nightly import **prunes** products
that vanish from a merchant feed. A hand-picked product that goes out of the feed is
**deleted from the shelf with no trace** — a curator returns to a shelf of 9 they set to 12
and cannot tell what left or why.

Options: keep the CASCADE and record picks in a small audit/pin table so admin can show
"3 picks dropped out of the feed", or snapshot name+image on the pick row. At minimum the
admin UI must **show the current count and flag drift** rather than presenting the shelf as
whatever survived.

### 3. Two client-side filters hide picks without saying so

- `PersonaShelf.tsx`: `MIN_ITEMS = 4` — a shelf with 3 picks **renders nothing at all**.
- `usePersonaPicks`: filters out `in_stock === false` — an in-feed but out-of-stock pick
  disappears from the shelf while still looking fine in admin.

So a curator can publish a shelf, load `/discover`, and see nothing, with no explanation.
The admin editor must surface both: "will not display — needs at least 4 in-stock picks."

---

## Design decisions to make (each changes the build)

1. **New `kind='editorial'` on `gift_personas`, or a separate table?**
   Recommend the new `kind`. It inherits the renderer, the hooks, the sort order and the
   i18n labels; a separate table duplicates all of it. The cost is the two guards in
   landmine 1.

2. **Scheduling: enforce in RLS or in the client?**
   Recommend **RLS**. Add `starts_at`/`ends_at timestamptz` and extend the SELECT policy to
   `is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())`.
   An unpublished shelf is then not merely hidden — it is not fetchable. Admin still sees
   everything because it reads through `supabaseAdmin` (service role bypasses RLS).
   Note `usePersonas` also filters `is_active` client-side; leave it, it is harmless.

3. **Should an editorial shelf rotate?**
   `usePersonaPicks` calls `rotateByDay()` on every shelf. For a hand-ordered shelf that
   silently overrides the curator's ordering. Recommend skipping rotation when
   `kind='editorial'` — if someone ranked the picks, honour the ranking.

4. **Should "view more" apply?**
   `useShelfContinuation` appends *uncurated* products of the same `product_type` behind a
   "no longer hand-picked" heading. On a deliberately-curated statement shelf that dilutes
   the point. Recommend disabling tier 2 for editorial.

5. **Cache lag on the schedule.** `usePersonas` has `staleTime: 1h`, picks 30 min. A shelf
   scheduled for 09:00 appears up to an hour later for a warm client. Probably fine for
   seasonal use — but if the curator expects to-the-minute, say so up front.

---

## Suggested build order

1. Migration: `kind` check constraint widened to include `'editorial'`; add `starts_at`,
   `ends_at`; replace the `gift_personas` SELECT policy with the schedule-aware one.
2. Curator guards (landmine 1) — do this **before** anything is hand-picked, not after.
3. `app/admin/editorial/page.tsx` + `actions.ts`: list / create / edit shelves
   (labels lt+en, `description`, schedule window, `is_active`, `sort_order`).
4. Pick management: search `inspo_products` (service role), add/remove, drag to set `rank`,
   edit `reason` per pick. Handle the composite PK — adding an existing product must update,
   not throw (`upsert` on `(persona_id, product_id)`).
5. Readiness panel in admin: in-stock count, `< 4` warning, dropped-pick drift.
6. Renderer: skip rotation + skip tier 2 for editorial.
7. Add `/admin/editorial` to `AdminNav`.

## Verification checklist

All verified 2026-08-13 against prod, using a temporary `zz-verify-editorial` shelf that was
deleted afterwards (it was created with `starts_at` a week out, so it was never visible).

- [x] Shelf with `starts_at` in the future is **absent from the anon PostgREST response** — checked as `role anon`, 0 rows
- [x] Shelf past `ends_at` disappears — 0 rows as `anon`
- [x] `refresh-personas.ts --dry-run` excludes editorial: listed 13 shelves, the editorial one absent
- [x] `refresh-personas.ts zz-verify-editorial` refuses explicitly and exits non-zero
- [x] Under-4-pick shelf warns in admin ("Nerodoma Discover puslapyje — reikia bent 4…"), driven by the shared `MIN_ITEMS`
- [x] Ranking is preserved: `usePersonaPicks(id, { rotate: false })` for editorial, ranks came back 1→3 in order
- [x] Drift: 4 intent rows → 3 projected; the pruned product stayed nameable via `name_snapshot`
- [x] `editorial_picks` unreadable by `anon` (RLS on, no policies)

## How it was built

Decisions taken (both confirmed with Justas before starting):

- **Landmine 2 → intent table.** `editorial_picks` holds the curator's list with **no FK to
  `inspo_products`**, plus `name_snapshot` / `image_snapshot`. `persona_products` became a
  projection, rebuilt by `sync_editorial_picks(persona_id)`. A pruned product therefore leaves
  the shelf but stays named in admin, and comes back by itself if it returns to the feed.
- **Migration applied straight to prod** (`supabase/migrations/20260813090000_editorial_shelves.sql`).

Files: `app/admin/editorial/` (actions, list page, `[id]` editor, `_lib/{types,health,dates}.ts`),
`lib/discover/shelf-rules.ts` (shared `MIN_ITEMS`, so admin and the renderer cannot drift),
plus edits to `PersonaShelf.tsx`, `usePersonas.ts`, `DiscoverClient.tsx`, `AdminNav.tsx`,
`refresh-personas.ts`, `lib/personas/refresh.ts`.

One gap the brief did not mention: `DiscoverClient.tsx` filtered inline shelves with
`kind === "theme"`, so an editorial shelf would have rendered nowhere. It now accepts both.

### Still open

- Nothing calls `sync_editorial_picks(null)` on a schedule. Picks that drop out of the feed are
  restored only when an admin opens the shelf and presses "Sinchronizuoti". Wiring it into the
  nightly import would close that loop.
- `usePersonas` caches for 1h, so a shelf scheduled for 09:00 can appear up to an hour late for
  a warm client. Admin says so under the schedule fields; revisit only if it bites.
