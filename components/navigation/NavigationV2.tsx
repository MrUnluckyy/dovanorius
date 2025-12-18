"use client";
import Link from "next/link";
import { LocaleSwitcher } from "../LocaleSwitcher";
import { useTranslations } from "next-intl";
import { User } from "@supabase/supabase-js";
import { Logo } from "../Logo";
import {
  LuX,
  LuMenu,
  LuHouse,
  LuGift,
  LuLayoutDashboard,
} from "react-icons/lu";
import { SignOutButton } from "@/app/(auth)/components/SignOutButton";
import Image from "next/image";
import NotificationsBell from "../notification/NotificationBell";
import NotificationsLive from "../notification/NotificationLive";
import { NavSearch } from "./NavSearch";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { CreateTriggerButton } from "../create/CreateTriggerButton";

export function NavigationV2({ user }: { user?: User | null }) {
  const t = useTranslations("Navbar");
  const ref = useRef<HTMLInputElement>(null);
  const pathnames = usePathname();

  return (
    <div className="drawer drawer-end font-heading">
      <input
        ref={ref}
        id="my-drawer-2"
        type="checkbox"
        className="drawer-toggle"
      />
      {/* DRAWER CONTENT: */}
      <div className="drawer-content flex flex-col">
        {/* Navbar */}
        <div className="navbar bg-base-100 w-full shadow-sm">
          <div className="flex w-full max-w-[1440px] px-4 mx-auto items-center">
            <div className="mx-2 flex-1 font-bold justify-between flex lg:block">
              <div className="flex gap-4 md:gap-8">
                <Link
                  href="/"
                  className="text-xl font-bold flex gap-2 items-center"
                >
                  <Image
                    src="/assets/logo.png"
                    alt="Logo"
                    width={40}
                    height={40}
                    className="shrink-0"
                  />
                  <p className="font-heading hidden md:block">Noriuto.lt</p>
                </Link>
                <NavSearch />
              </div>

              <div className="flex-none lg:hidden">
                <CreateTriggerButton />
                <NotificationsLive />
                <NotificationsBell />
                <label
                  htmlFor="my-drawer-2"
                  aria-label="open sidebar"
                  className="btn btn-square btn-ghost text-2xl"
                >
                  <LuMenu />
                </label>
              </div>
            </div>
            <div className="hidden flex-none lg:flex gap-2">
              {user ? (
                <>
                  <NotificationsLive />
                  <NotificationsBell />

                  <CreateTriggerButton />
                  <Link href="/dashboard" className="btn btn-ghost">
                    <LuHouse />
                    {t("dashboard")}
                  </Link>
                  <SignOutButton className="btn btn-ghost" />
                </>
              ) : (
                <>
                  <Link href="login" className="btn btn-ghost">
                    {t("login")}
                  </Link>
                  <Link href="register" className="btn btn-ghost">
                    {t("register")}
                  </Link>
                </>
              )}
              <LocaleSwitcher />
            </div>
          </div>
        </div>
      </div>

      <div className="drawer-side">
        <div className="menu bg-base-200 min-h-full w-full p-4">
          <div className="mb-8 flex justify-between">
            <Logo size="md" />
            <label
              htmlFor="my-drawer-2"
              aria-label="close sidebar"
              className="drawer-overlay text-4xl cursor-pointer mb-10"
            >
              <LuX />
            </label>
          </div>
          <div className="flex flex-col gap-4 items-start text-2xl">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className={`btn btn-ghost text-2xl ${
                    pathnames.includes("dashboard")
                      ? "font-bold "
                      : "font-normal"
                  }`}
                  onClick={() => ref.current?.click()}
                >
                  <LuHouse />
                  {t("dashboard")}
                </Link>

                <div className="divider" />
                <SignOutButton className="btn btn-ghost text-2xl font-normal" />
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost text-2xl">
                  {t("login")}
                </Link>
                <Link href="/register" className="btn btn-ghost text-2xl">
                  {t("register")}
                </Link>
              </>
            )}
            {/* <LocaleSwitcher /> */}
          </div>
        </div>
      </div>
    </div>
  );
}
