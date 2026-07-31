"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuChartNoAxesColumn, LuBuilding2 } from "react-icons/lu";

const items = [
  { href: "/admin", label: "Analitika", icon: LuChartNoAxesColumn, exact: true },
  { href: "/admin/partners", label: "Partneriai", icon: LuBuilding2 },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-base-300 bg-base-100">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <span className="font-heading text-base font-bold">Noriuto · Admin</span>
        <div className="flex flex-1 items-center gap-1">
          {items.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-primary font-semibold text-primary-content"
                    : "text-base-content/70 hover:bg-base-200"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
