"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { AgeGroup, Audience } from "@/types/inspo";

/**
 * Resolves who the discover feed is for, in priority order:
 *
 *   1. `profiles.discover_audience` — what they last chose here.
 *   2. `profiles.gender` — self-declared on the profile page.
 *   3. "everyone".
 *
 * Previously the audience was `useState("everyone")` and nothing read the
 * profile at all, so every visit reset to unfiltered — which is why a signed-in
 * man kept landing on bras and skirts. `discover_audience` already existed as a
 * column; no code had ever written to it.
 *
 * Changing the audience persists it (fire-and-forget: a failed write must never
 * block browsing).
 */
export function useDiscoverAudience(userId: string | null) {
  const supabase = createClient();
  const [audience, setAudienceState] = useState<Audience>("everyone");
  // Until the profile has been read, shelves would render against the wrong
  // audience and then swap — so callers wait on this instead of flashing.
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!userId) {
      setResolved(true);
      return;
    }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("gender, discover_audience")
        .eq("id", userId)
        .maybeSingle();

      if (!active) return;

      const saved = data?.discover_audience;
      if (saved === "her" || saved === "him" || saved === "everyone") {
        setAudienceState(saved);
      } else if (data?.gender === "female") {
        setAudienceState("her");
      } else if (data?.gender === "male") {
        setAudienceState("him");
      }
      setResolved(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const setAudience = useCallback(
    (next: Audience) => {
      setAudienceState(next);
      if (!userId) return;
      void supabase
        .from("profiles")
        .update({ discover_audience: next })
        .eq("id", userId);
    },
    [userId, supabase]
  );

  return { audience, setAudience, resolved };
}

/**
 * The gender lens for whichever age bracket is being browsed.
 *
 * The persisted lens describes the SHOPPER — it is seeded from their own
 * `profiles.gender` and remembers what they last chose — which makes it the
 * right default for an adult gift and the wrong one for a child's. Left
 * coupled, a father shopping for his daughter got "Berniukui" preselected
 * because he is male, which is the same class of bug as the man who kept being
 * shown bras.
 *
 * Worse, it wrote back: choosing "Mergaitei" while browsing the kids catalogue
 * persisted `discover_audience = 'her'`, so his adult feed silently became "Jai"
 * on the next visit. A child's gender is not a fact about the shopper and must
 * not be stored as one.
 *
 * So the kid and teen brackets get their own in-memory lens, defaulted to
 * "everyone" and forgotten on leaving. Only the adult bracket persists.
 */
export function useGiftAudience(userId: string | null, ageGroup: AgeGroup) {
  const adult = useDiscoverAudience(userId);
  const [young, setYoung] = useState<Audience>("everyone");
  const isAdult = ageGroup === "adult";

  return {
    audience: isAdult ? adult.audience : young,
    setAudience: isAdult ? adult.setAudience : setYoung,
    resolved: adult.resolved,
  };
}
