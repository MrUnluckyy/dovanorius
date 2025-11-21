import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";

export type Crumb = {
  label: string;
  href: string;
};

export default function BreadCrumbsManual({ crumbs }: { crumbs: Crumb[] }) {
  const t = useTranslations("Navbar");
  return (
    <div className="breadcrumbs text-sm font-heading my-4">
      <ul>
        <li>
          <Link href="/dashboard">{t("dashboard")}</Link>
        </li>
        {crumbs.map(({ label, href }) => (
          <li key={href}>
            <Link href={href}>{t(label)}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
