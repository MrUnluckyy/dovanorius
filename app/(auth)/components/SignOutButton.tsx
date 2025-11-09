"use client";

import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LuLogOut } from "react-icons/lu";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("Navbar");
  const supabase = createClient();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      toast.error("Klaida atsijungiant.");
    }
  };
  return (
    <button className={className} onClick={handleSignOut}>
      <LuLogOut />
      {t("signOut")}
    </button>
  );
}
