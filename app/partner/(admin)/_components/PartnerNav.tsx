"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Partner } from "@/types/partner";
import { LuPackage, LuUsers, LuLayoutDashboard } from "react-icons/lu";

const navItems = [
  { href: "/partner", label: "Apžvalga", icon: LuLayoutDashboard, exact: true },
  { href: "/partner/products", label: "Produktai", icon: LuPackage },
  { href: "/partner/team", label: "Komanda", icon: LuUsers },
];

export function PartnerNav({
  partner,
  role,
}: {
  partner: Partner;
  role: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="bg-base-100 border-b border-base-300">
      <div className="max-w-5xl mx-auto px-4 flex items-center gap-6 h-14">
        <span className="font-heading font-bold text-base truncate max-w-[160px]">
          {partner.name}
        </span>
        <div className="flex items-center gap-1 flex-1">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-content font-semibold"
                    : "hover:bg-base-200 text-base-content/70"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>
        <span className="badge badge-ghost text-xs capitalize">{role}</span>
      </div>
    </nav>
  );
}
