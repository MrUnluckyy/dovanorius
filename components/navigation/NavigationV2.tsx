"use client";
import Link from "next/link";
import { LocaleToggle } from "../LocaleToggle";
import { useTranslations } from "next-intl";
import { User } from "@supabase/supabase-js";
import {
  LuX,
  LuMenu,
  LuHouse,
  LuCalendar,
  LuCircleUser,
  LuSparkles,
  LuSettings,
  LuChevronRight,
  LuUserRound,
} from "react-icons/lu";
import { SignOutButton } from "@/app/(auth)/components/SignOutButton";
import Image from "next/image";
import NotificationsBell from "../notification/NotificationBell";
import NotificationsLive from "../notification/NotificationLive";
import { NavSearch } from "./NavSearch";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { CreateTriggerButton } from "../create/CreateTriggerButton";
import useProfile from "@/hooks/useProfile";
import { AvatarImg } from "@/components/AvatarImg";
import { Hero3D } from "@/components/ui/Hero3D";

/** Phone top-bar buttons: one size and one radius, so the row reads as a set. */
const ICON_BTN =
  "btn btn-ghost btn-square h-10 min-h-10 w-10 rounded-xl text-(--nr-ink) hover:bg-(--nr-tile)";

export function NavigationV2({ user }: { user?: User | null }) {
  const t = useTranslations("Navbar");
  const ref = useRef<HTMLInputElement>(null);
  const pathnames = usePathname() ?? "";

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
    pathnames && !pathnames.startsWith("/prisijungti") && !pathnames.startsWith("/registracija")
      ? `/prisijungti?next=${encodeURIComponent(pathnames)}`
      : "/prisijungti";

  // Matched on whole segments: these were includes("discover") and friends,
  // which stopped matching anything when the routes became Lithuanian.
  const isActive = (prefix: string) =>
    pathnames === prefix || pathnames.startsWith(`${prefix}/`);

  const closeDrawer = () => {
    if (ref.current) ref.current.checked = false;
  };

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
        <div className="navbar min-h-16 w-full bg-base-100 px-0 shadow-sm">
          <div className="mx-auto flex w-full max-w-[1440px] items-center px-4">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 font-bold lg:justify-start lg:gap-8">
              {/* Signed in, the logo goes to the dashboard: sending an existing
                  user to the marketing landing page pitches them a product
                  they already use. */}
              <div className="flex min-w-0 items-center gap-6 lg:gap-8">
              <Link
                href={signedIn ? "/mano" : "/"}
                className="flex shrink-0 items-center gap-2 text-xl font-bold"
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
              {/* The inline field needs room; on phones it was squeezed into
                  an empty box. Phones get the icon, which opens the same
                  search as a full-width overlay. */}
              <div className="hidden md:block">
                <NavSearch />
              </div>
              </div>

              <div className="flex flex-none items-center gap-1 lg:hidden">
                <div className="md:hidden">
                  <NavSearch trigger="icon" triggerLabel={t("search")} triggerClassName={ICON_BTN} />
                </div>
                {/* Discover used to live only inside the drawer on phones, one
                    menu-tap away from everyone who never opens the menu. It
                    needs no account, so it shows signed in or out. */}
                <Link
                  href="/idejos"
                  aria-label={t("discover")}
                  title={t("discover")}
                  aria-current={isActive("/idejos") ? "page" : undefined}
                  className={`${ICON_BTN} ${isActive("/idejos") ? "bg-(--nr-tile)" : ""}`}
                >
                  <LuSparkles className="h-5 w-5" />
                </Link>
                {/* Creating anything needs an account. A guest tapping this
                    would build a board on an anonymous session and lose it the
                    moment their cookies cleared. */}
                {signedIn && (
                  <CreateTriggerButton
                    iconOnly
                    className="btn btn-primary btn-circle mx-0.5 h-10 min-h-10 w-10 shadow-[var(--nr-shadow-btn)]"
                  />
                )}
                {/* The bell reads the session with a non-null assertion, so it
                    may only mount for a signed-in user. */}
                {signedIn && <NotificationsBell triggerClassName={ICON_BTN} />}
                <NotificationsLive />
                <label
                  htmlFor="my-drawer-2"
                  aria-label={t("openMenu")}
                  className={ICON_BTN}
                >
                  <LuMenu className="h-5 w-5" />
                </label>
              </div>
            </div>
            <div className="hidden flex-none gap-2 lg:flex">
              {/* Discover is useful signed-out — it needs no account and is the
                  main reason to visit without one — so it sits outside the
                  auth branch rather than beside Dashboard. */}
              <Link
                href="/idejos"
                className={`btn btn-ghost ${
                  isActive("/idejos") ? "font-bold" : "font-normal"
                }`}
              >
                <LuSparkles />
                {t("discover")}
              </Link>
              {signedIn ? (
                <>
                  <NotificationsBell />
                  <NotificationsLive />
                  <CreateTriggerButton className="btn btn-primary ml-2" />
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
                        <Link href="/mano">
                          <LuHouse />
                          {t("dashboard")}
                        </Link>
                      </li>
                      <li>
                        <Link href="/renginiai">
                          <LuCalendar />
                          {t("events")}
                        </Link>
                      </li>
                      <li>
                        <Link href="/paskyra">
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
                    <span className="hidden xl:flex items-center gap-1.5 self-center pr-1 text-sm text-base-content/70">
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
                  <Link href="/registracija" className="btn btn-ghost">
                    {t("register")}
                  </Link>
                </>
              )}
              {!signedIn && <LocaleToggle />}
            </div>
          </div>
        </div>
      </div>

      {/* Phone menu: a panel over the page rather than a blank full screen,
          so where you are stays in view behind it. */}
      <div className="drawer-side z-[90]">
        <label
          htmlFor="my-drawer-2"
          aria-label={t("closeMenu")}
          className="drawer-overlay"
        />
        <aside className="flex min-h-full w-[min(88vw,22rem)] flex-col bg-(--nr-cream) px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 font-body">
          <div className="mb-4 flex items-center justify-between">
            <Link href={signedIn ? "/mano" : "/"} onClick={closeDrawer} className="flex items-center gap-2">
              <Image src="/assets/logo.png" alt="" width={36} height={36} />
              <span className="font-heading text-lg font-bold">Noriuto.lt</span>
            </Link>
            <label
              htmlFor="my-drawer-2"
              aria-label={t("closeMenu")}
              className={ICON_BTN}
            >
              <LuX className="h-5 w-5" />
            </label>
          </div>

          {signedIn ? (
            <ProfileCard userId={user!.id} onNavigate={closeDrawer} />
          ) : (
            <div className="rounded-3xl bg-(--nr-tile) p-4">
              <div className="flex items-center gap-3">
                <Hero3D name="gift" size={44} still />
                <p className="font-heading text-base font-bold leading-snug">
                  {isGuest ? t("guestModeHint") : t("drawerPitch")}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href="/registracija"
                  onClick={closeDrawer}
                  className={`btn h-11 min-h-11 rounded-xl ${isGuest ? "btn-ghost border-(--nr-border) bg-(--nr-surface)" : "btn-primary"}`}
                >
                  {t("register")}
                </Link>
                <Link
                  href={loginHref}
                  onClick={closeDrawer}
                  className={`btn h-11 min-h-11 rounded-xl ${isGuest ? "btn-primary" : "btn-ghost border-(--nr-border) bg-(--nr-surface)"}`}
                >
                  {t("login")}
                </Link>
              </div>
            </div>
          )}

          <nav className="mt-5 flex flex-col gap-1" aria-label={t("mainMenu")}>
            {signedIn && (
              <DrawerLink href="/mano" icon={<LuHouse />} active={isActive("/mano")} onNavigate={closeDrawer}>
                {t("dashboard")}
              </DrawerLink>
            )}
            <DrawerLink href="/idejos" icon={<LuSparkles />} active={isActive("/idejos")} onNavigate={closeDrawer}>
              {t("discover")}
            </DrawerLink>
            {signedIn && (
              <DrawerLink href="/renginiai" icon={<LuCalendar />} active={isActive("/renginiai")} onNavigate={closeDrawer}>
                {t("events")}
              </DrawerLink>
            )}
          </nav>

          {/* The rarely used controls, out of the way at the bottom. */}
          <div className="mt-auto flex flex-col gap-1 border-t border-(--nr-border) pt-3 text-[15px]">
            {signedIn && (
              <Link
                href="/paskyra"
                onClick={closeDrawer}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 hover:bg-(--nr-tile) ${isActive("/paskyra") ? "font-semibold" : ""}`}
              >
                <LuSettings className="h-4 w-4 text-(--nr-muted)" />
                {t("accountSettings")}
              </Link>
            )}
            <div className="flex h-11 items-center justify-between px-3">
              <span className="text-(--nr-muted)">{t("language")}</span>
              <LocaleToggle />
            </div>
            {signedIn && (
              <SignOutButton className="btn btn-ghost h-11 min-h-11 justify-start gap-3 rounded-xl px-3 text-[15px] font-normal text-(--nr-muted)" />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DrawerLink({
  href,
  icon,
  active,
  onNavigate,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active: boolean;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex h-14 items-center gap-3 rounded-2xl px-2 text-[17px] transition-colors ${
        active ? "bg-(--nr-surface) font-semibold shadow-sm" : "hover:bg-(--nr-tile)"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl [&>svg]:h-5 [&>svg]:w-5 ${
          active ? "bg-(--nr-yellow) text-(--nr-ink)" : "bg-(--nr-tile) text-(--nr-ink)"
        }`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex-1">{children}</span>
    </Link>
  );
}

/** Who you are, at the top of the menu — and the way to your public profile. */
function ProfileCard({ userId, onNavigate }: { userId: string; onNavigate: () => void }) {
  const t = useTranslations("Navbar");
  const { profile } = useProfile();
  const name = profile?.display_name?.trim() || t("profile");

  return (
    <Link
      href={`/zmones/${userId}`}
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-3xl bg-(--nr-tile) p-3 pr-4 transition-colors hover:bg-(--nr-yellow)/40"
    >
      <AvatarImg
        src={profile?.avatar_url}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-(--nr-yellow)"
        fallback={
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-(--nr-surface) ring-2 ring-(--nr-yellow)">
            <LuUserRound className="h-5 w-5 text-(--nr-muted)" />
          </span>
        }
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-heading truncate text-base font-bold">{name}</span>
        <span className="text-sm text-(--nr-muted)">{t("viewProfile")}</span>
      </span>
      <LuChevronRight className="h-4 w-4 shrink-0 text-(--nr-muted)" aria-hidden />
    </Link>
  );
}
