import Link from "next/link";
import { LocaleSwitcher } from "../LocaleSwitcher";
import { useTranslations } from "next-intl";
import { User } from "@supabase/supabase-js";
import { Logo } from "../Logo";
import { LuUser, LuClipboardList, LuX, LuMenu } from "react-icons/lu";

export function NavigationV2({ user }: { user?: User | null }) {
  const t = useTranslations("Navbar");
  return (
    <div className="drawer">
      <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
      {/* DRAWER CONTENT: */}
      <div className="drawer-content flex flex-col">
        {/* Navbar */}
        <div className="navbar bg-base-100 w-full shadow-sm">
          <div className="flex w-full max-w-[1440px] px-4 mx-auto items-center">
            <div className="flex-none lg:hidden">
              <label
                htmlFor="my-drawer-2"
                aria-label="open sidebar"
                className="btn btn-square btn-ghost text-2xl"
              >
                <LuMenu />
              </label>
            </div>

            <div className="mx-2 flex-1 px-2 font-bold justify-between flex lg:block">
              <Logo />
              <div className="lg:hidden">
                <LocaleSwitcher />
              </div>
            </div>
            <div className="hidden flex-none lg:flex gap-2">
              {user ? (
                <>
                  <Link href="/boards" className="btn btn-ghost">
                    <LuClipboardList />
                    {t("boards")}
                  </Link>
                  <Link href="/profile" className="btn btn-ghost">
                    <LuUser />
                    {t("profile")}
                  </Link>
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
          <label
            htmlFor="my-drawer-2"
            aria-label="close sidebar"
            className="drawer-overlay text-4xl cursor-pointer mb-12"
          >
            <LuX />
          </label>
          <div className="my-8">
            <Logo />
          </div>
          <div className="flex flex-col gap-4 items-start text-2xl">
            {user ? (
              <>
                <Link href="/boards" className="btn btn-ghost text-2xl">
                  <LuClipboardList />
                  {t("boards")}
                </Link>
                <Link href="/profile" className="btn btn-ghost text-2xl">
                  <LuUser />
                  {t("profile")}
                </Link>
              </>
            ) : (
              <>
                <Link href="login" className="btn btn-ghost text-2xl">
                  {t("login")}
                </Link>
                <Link href="register" className="btn btn-ghost text-2xl">
                  {t("register")}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
