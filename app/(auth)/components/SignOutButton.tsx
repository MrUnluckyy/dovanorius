"use client";

import { createClient } from "@/utils/supabase/client";

export function SignOutButton() {
  const supabase = createClient();
  return (
    <button
      className="btn"
      onClick={async () => {
        await supabase.auth.signOut();
      }}
    >
      Sign out
    </button>
  );
}
