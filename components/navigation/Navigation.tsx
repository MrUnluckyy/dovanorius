"use client";
import Link from "next/link";
import { SignOutButton } from "@/app/(auth)/components/SignOutButton";
import { User } from "@supabase/supabase-js";
import ThemeSelector from "../ThemeSelector";

export function Navigation({ user }: { user: User | null }) {
  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="max-w-[1440px] w-full mx-auto">
        <div className="navbar-start">
          <Link href="/" className="btn btn-ghost text-xl">
            :D noriu
          </Link>
        </div>

        <div className="navbar-end">
          {user ? (
            <SignOutButton />
          ) : (
            <div className="space-x-1">
              <Link href="login" className="btn">
                Login
              </Link>
              <Link href="register" className="btn">
                Register
              </Link>
            </div>
          )}
          <ThemeSelector />
        </div>
      </div>
    </div>
  );
}
