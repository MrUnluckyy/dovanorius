"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import toast from "react-hot-toast";
import type { Partner } from "@/types/partner";
import {
  LuPackage,
  LuUsers,
  LuLayoutDashboard,
  LuChevronDown,
  LuCheck,
  LuStore,
} from "react-icons/lu";
import { setActivePartner } from "../actions";

const navItems = [
  { href: "/partner", label: "Apžvalga", icon: LuLayoutDashboard, exact: true },
  { href: "/partner/products", label: "Produktai", icon: LuPackage },
  { href: "/partner/store", label: "Parduotuvė", icon: LuStore },
  { href: "/partner/team", label: "Komanda", icon: LuUsers },
];

export function PartnerNav({
  partner,
  role,
  memberships,
}: {
  partner: Partner;
  role: string;
  /** Every partner the caller belongs to. More than one => show the switcher. */
  memberships: { partnerId: string; name: string }[];
}) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const multi = memberships.length > 1;

  function handleSwitch(partnerId: string) {
    if (partnerId === partner.id) return;
    startTransition(async () => {
      const res = await setActivePartner(partnerId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
    });
  }

  return (
    <nav className="bg-base-100 border-b border-base-300">
      <div className="max-w-5xl mx-auto px-4 flex items-center gap-6 h-14">
        {multi ? (
          <div className="dropdown">
            <button
              tabIndex={0}
              className="flex items-center gap-1 font-heading font-bold text-base truncate max-w-[200px] hover:opacity-70"
              disabled={pending}
            >
              <span className="truncate">{partner.name}</span>
              <LuChevronDown size={15} className="shrink-0 opacity-60" />
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu z-10 mt-2 w-60 rounded-box bg-base-100 p-2 shadow"
            >
              <li className="menu-title text-xs">Pasirinkite partnerį</li>
              {memberships.map((m) => (
                <li key={m.partnerId}>
                  <button
                    onClick={() => handleSwitch(m.partnerId)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{m.name}</span>
                    {m.partnerId === partner.id && (
                      <LuCheck size={14} className="shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <span className="font-heading font-bold text-base truncate max-w-[160px]">
            {partner.name}
          </span>
        )}

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
