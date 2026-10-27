"use client";

import { useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { rememberSignupContext, trackListViewed } from "@/lib/analytics";

const VISITOR_KEY = "nr_visitor";

/**
 * A random id per browser, so record_board_open can count an anonymous
 * visitor once per board (it wants 16–64 chars). Not tied to any person.
 */
function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/**
 * Mounted on every page that shows someone's list to others (/b/<slug>,
 * /b/s/<token>, a profile's board). Three jobs, once per visit:
 *
 * - `list_viewed`, with who is looking.
 * - record_board_open, the same RPC the app calls. Its row is what sends the
 *   owner's `received_view` from the database, and what the app's challenges
 *   count; the website never called it, so web visits were invisible to both.
 * - for someone without an account, remember that a shared list is what
 *   brought them, in case they sign up afterwards.
 */
export function BoardViewBeacon({
  boardId,
  ownerId,
  userId,
  isGuest,
}: {
  boardId: string;
  ownerId: string;
  userId?: string | null;
  /** An anonymous (guest-reserve) session: signed out, as far as this goes. */
  isGuest?: boolean;
}) {
  useEffect(() => {
    const hasAccount = !!userId && !isGuest;
    const viewerRole =
      userId && userId === ownerId ? "owner" : hasAccount ? "signed_in" : "anonymous";

    trackListViewed({ boardId, viewerRole });

    if (viewerRole !== "owner") {
      // The RPC ignores owners and members itself, and dedupes per visitor.
      void createClient()
        .rpc("record_board_open", {
          p_board_id: boardId,
          p_visitor: userId ? null : visitorId(),
          p_source: "web",
        })
        .then(({ error }) => {
          if (error) console.warn("record_board_open:", error.message);
        });
    }

    if (!hasAccount) rememberSignupContext("reserve_flow", boardId);
  }, [boardId, ownerId, userId, isGuest]);

  return null;
}
