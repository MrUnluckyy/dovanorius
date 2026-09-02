"use client";
import Link from "next/link";
import { LocaleToggle } from "../LocaleToggle";
import { useTranslations } from "next-intl";
import { User } from "@supabase/supabase-js";
import { Logo } from "../Logo";
import {
  LuX,
  LuMenu,
  LuHouse,
  LuCircleUser,
  LuSparkles,
  LuSettings,
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

  /**
   * A guest who has reserved a gift carries an anonymous Supabase session. It
   * is a session, not an account: no email, no dashboard, nothing to sign out
   * of. Treating it as "signed in" hid Login and Register from exactly the
   * people who already HAD an account and simply hadn't signed into it — so
   * they kept reserving as guests, and their holds landed in an account they
   * can never see. Anonymous is signed out, and says so.
   */
  const isGuest = !!user && user.is_anonymous === true;
  const signedIn = !!user && !isGuest;

  // Signing in from a board should come back to that board, not dump the
  // giver on the dashboard with the gift still unreserved.
  const loginHref =
    pathnames && !pathnames.startsWith("/login") && !pathnames.startsWith("/register")
      ? `/login?next=${encodeURIComponent(pathnames)}`
      : "/login";

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
                {/* Signed in, the logo goes to the dashboard: sending an existing
                    user to the marketing landing page pitches them a product
                    they already use. This is also what makes the separate
                    "Pagrindinis" link redundant, so it is gone. */}
                <Link
                  href={signedIn ? "/dashboard" : "/"}
                  className="text-xl font-bold flex gap-2 items-center"
                >
                  <Image
                    src="/assets/logo.png"
                    alt="Noriuto"
                    width={40}
                    height={40}
                    className="shrink-0"
                  />
                  <p className="font-heading hidden md:block">Noriuto.lt</p>
                </Link>
                <NavSearch />
              </div>

              <div className="flex flex-none items-center gap-1 lg:hidden">
                {/* Creating anything needs an account. A guest tapping this
                    would build a board on an anonymous session and lose it the
                    moment their cookies cleared. */}
                {signedIn && <CreateTriggerButton />}
                {/* The bell reads the session with a non-null assertion, so it
                    may only mount for a signed-in user. */}
                {signedIn && <NotificationsBell />}
                <NotificationsLive />
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
              {/* Discover is useful signed-out — it needs no account and is the
                  main reason to visit without one — so it sits outside the
                  auth branch rather than beside Dashboard. */}
              <Link
                href="/discover"
                className={`btn btn-ghost ${
                  pathnames.includes("discover") ? "font-bold" : "font-normal"
                }`}
              >
                <LuSparkles />
                {t("discover")}
              </Link>
              {signedIn ? (
                <>
                  <NotificationsBell />
                  <NotificationsLive />
                  <CreateTriggerButton />
                  {/* Sign-out and locale move into a menu: they are the least
                      used controls here and were competing with the primary
                      action at the same visual weight. */}
                  <div className="dropdown dropdown-end">
                    <div
                      tabIndex={0}
                      role="button"
                      aria-label={t("account")}
                      className="btn btn-ghost btn-circle"
                    >
                      <LuCircleUser className="text-xl" />
                    </div>
                    <ul
                      tabIndex={0}
                      className="dropdown-content menu z-50 mt-2 w-56 rounded-box bg-base-100 p-2 shadow-lg ring-1 ring-base-300"
                    >
                      <li>
                        <Link href="/dashboard">
                          <LuHouse />
                          {t("dashboard")}
                        </Link>
                      </li>
                      <li>
                        <Link href="/account">
                          <LuSettings />
                          {t("accountSettings")}
                        </Link>
                      </li>
                      <li className="flex flex-row items-center justify-between px-3 py-2">
                        <span className="text-sm opacity-70">{t("language")}</span>
                        <LocaleToggle />
                      </li>
                      <li>
                        <SignOutButton className="btn btn-ghost justify-start" />
                      </li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  {isGuest && (
                    <span className="hidden xl:flex items-center gap-1.5 self-center pr-1 text-sm text-base-content/60">
                      <LuCircleUser className="text-base" />
                      {t("guestMode")}
                    </span>
                  )}
                  {/* For a guest this is the way back into an account they
                      already have, so it carries the weight of one. */}
                  <Link
                    href={loginHref}
                    className={isGuest ? "btn btn-primary" : "btn btn-ghost"}
                  >
                    {t("login")}
                  </Link>
                  <Link href="/register" className="btn btn-ghost">
                    {t("register")}
                  </Link>
                </>
              )}
              {!signedIn && <LocaleToggle />}
            </div>
          </div>
        </div>
      </div>

      <div className="drawer-side">
        <div className="menu bg-base-100 min-h-full w-full p-4">
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
          {/* Full-width rows rather than shrink-to-fit buttons: on a phone the
              whole row should be tappable, not just the text. */}
          <div className="flex w-full flex-col gap-1 text-xl">
            <Link
              href="/discover"
              className={`btn btn-ghost w-full justify-start gap-3 text-xl ${
                pathnames.includes("discover") ? "font-bold" : "font-normal"
              }`}
              onClick={() => ref.current?.click()}
            >
              <LuSparkles />
              {t("discover")}
            </Link>
            {signedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className={`btn btn-ghost w-full justify-start gap-3 text-xl ${
                    pathnames.includes("dashboard") ? "font-bold" : "font-normal"
                  }`}
                  onClick={() => ref.current?.click()}
                >
                  <LuHouse />
                  {t("dashboard")}
                </Link>
                <Link
                  href="/account"
                  className={`btn btn-ghost w-full justify-start gap-3 text-xl ${
                    pathnames.includes("account") ? "font-bold" : "font-normal"
                  }`}
                  onClick={() => ref.current?.click()}
                >
                  <LuSettings />
                  {t("accountSettings")}
                </Link>

                <div className="divider my-2" />
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-base opacity-70">{t("language")}</span>
                  <LocaleToggle />
                </div>
                <SignOutButton className="btn btn-ghost w-full justify-start gap-3 text-xl font-normal" />
              </>
            ) : (
              <>
                <div className="divider my-2" />
                {isGuest && (
                  <p className="flex items-start gap-2 px-4 pb-3 text-base leading-snug text-base-content/60">
                    <LuCircleUser className="mt-0.5 shrink-0 text-lg" />
                    {t("guestModeHint")}
                  </p>
                )}
                <Link
                  href={loginHref}
                  className={`btn w-full justify-start text-xl ${
                    isGuest ? "btn-primary" : "btn-ghost"
                  }`}
                  onClick={() => ref.current?.click()}
                >
                  {t("login")}
                </Link>
                <Link
                  href="/register"
                  className={`btn w-full justify-start text-xl ${
                    isGuest ? "btn-ghost" : "btn-primary"
                  }`}
                  onClick={() => ref.current?.click()}
                >
                  {t("register")}
                </Link>
                <div className="mt-2 flex items-center justify-between px-4 py-2">
                  <span className="text-base opacity-70">{t("language")}</span>
                  <LocaleToggle />
                </div>
              </>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
