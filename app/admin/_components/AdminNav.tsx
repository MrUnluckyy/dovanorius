"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import {
  LuChartNoAxesColumn,
  LuBuilding2,
  LuSparkles,
  LuLifeBuoy,
} from "react-icons/lu";

type Page = {
  href: string;
  label: string;
  /** Match this path only, not its children — for pages whose children are other pages. */
  exact?: boolean;
};

type Section = { label: string; icon: IconType; pages: Page[] };

/**
 * Four sections instead of seven flat tabs. Pages keep their URLs; a section
 * with more than one page shows them as a second row once you're in it.
 */
const sections: Section[] = [
  {
    label: "Analitika",
    icon: LuChartNoAxesColumn,
    pages: [
      { href: "/admin", label: "Apžvalga", exact: true },
      { href: "/admin/searches", label: "Paieškos" },
      { href: "/admin/partners/orders", label: "Partnerių užsakymai" },
    ],
  },
  {
    label: "Partneriai",
    icon: LuBuilding2,
    pages: [
      { href: "/admin/partners", label: "Partneriai", exact: true },
      { href: "/admin/partners/queue", label: "Moderavimas" },
    ],
  },
  { label: "Lentynos", icon: LuSparkles, pages: [{ href: "/admin/editorial", label: "Lentynos" }] },
  { label: "Pranešimai", icon: LuLifeBuoy, pages: [{ href: "/admin/reports", label: "Pranešimai" }] },
];

const matches = (pathname: string, page: Page) =>
  page.exact ? pathname === page.href : pathname === page.href || pathname.startsWith(`${page.href}/`);

export function AdminNav() {
  const pathname = usePathname();
  const current = sections.find((s) => s.pages.some((p) => matches(pathname, p)));

  return (
    <nav className="border-b border-base-300 bg-base-100">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <span className="font-heading text-base font-bold">Noriuto · Admin</span>
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = section === current;
            return (
              <Link
                key={section.label}
                href={section.pages[0].href}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-primary font-semibold text-primary-content"
                    : "text-base-content/70 hover:bg-base-200"
                }`}
              >
                <Icon size={15} />
                {section.label}
              </Link>
            );
          })}
        </div>
      </div>

      {current && current.pages.length > 1 && (
        <div className="border-t border-base-200">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
            {current.pages.map((page) => {
              const active = matches(pathname, page);
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors ${
                    active
                      ? "border-primary font-semibold text-base-content"
                      : "border-transparent text-base-content/60 hover:text-base-content"
                  }`}
                >
                  {page.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
