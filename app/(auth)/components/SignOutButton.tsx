"use client";

import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LuLogOut } from "react-icons/lu";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("Navbar");
  const supabase = createClient();
  const router = useRouter();
  const { toastError } = useToast();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      toastError("Error signing out");
    }
  };
  return (
    <button className={className} onClick={handleSignOut}>
      <LuLogOut />
      {t("signOut")}
    </button>
  );
}
