"use client";

import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";

export function SignOutButton() {
  const t = useTranslations("Navbar");
  const supabase = createClient();
  return (
    <button
      className="btn"
      onClick={async () => {
        await supabase.auth.signOut();
      }}
    >
      {t("signOut")}
    </button>
  );
}
