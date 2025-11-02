"use client";
import Link from "next/link";
import { SignOutButton } from "@/app/(auth)/components/SignOutButton";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "../LocaleSwitcher";

export function Navigation({ user }: { user: User | null }) {
  const t = useTranslations("Navbar");
  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="max-w-[1440px] w-full mx-auto px-4">
        <div className="navbar-start">
          <Link href="/" className="text-xl font-bold">
            :D noriu
          </Link>
        </div>
        <div className="navbar-end space-x-1">
          {user ? (
            <>
              <SignOutButton />
              <Link href="/profile" className="btn">
                {t("profile")}
              </Link>
              <Link href="/boards" className="btn">
                {t("boards")}
              </Link>
            </>
          ) : (
            <>
              <Link href="login" className="btn">
                {t("login")}
              </Link>
              <Link href="register" className="btn">
                {t("register")}
              </Link>
            </>
          )}
          <LocaleSwitcher />
        </div>
      </div>
    </div>
  );
}
