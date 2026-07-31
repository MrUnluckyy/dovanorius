"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LuChevronDown, LuSearch, LuCheck } from "react-icons/lu";
import { useInspoBrands } from "@/hooks/useInspoBrands";

export function BrandFilter({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (brand: string | null) => void;
}) {
  const t = useTranslations("Discover");
  const { data: brands = [], isLoading } = useInspoBrands();
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? brands.filter((b) => b.brand.toLowerCase().includes(needle))
      : brands;
    return list.slice(0, 60);
  }, [brands, q]);

  const close = () => {
    setQ("");
    (document.activeElement as HTMLElement)?.blur();
  };

  return (
    <div ref={ref} className="dropdown">
      <div
        tabIndex={0}
        role="button"
        className={`btn btn-sm cursor-pointer gap-1.5 rounded-full normal-case ${
          value ? "btn-neutral" : "btn-ghost bg-base-200"
        }`}
      >
        {value ?? t("brand.all")}
        <LuChevronDown className="w-3.5 opacity-70" />
      </div>
      <div
        tabIndex={0}
        className="dropdown-content z-20 mt-1 w-64 rounded-box bg-base-100 p-2 shadow-lg ring-1 ring-base-300"
      >
        <label className="input input-sm mb-2 flex items-center gap-2 rounded-full">
          <LuSearch className="w-4 opacity-50" />
          <input
            className="grow"
            placeholder={t("brand.search")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <ul className="menu max-h-64 flex-nowrap overflow-y-auto p-0">
          <li>
            <button
              onClick={() => {
                onSelect(null);
                close();
              }}
              className={!value ? "active" : ""}
            >
              {t("brand.all")}
            </button>
          </li>
          {isLoading ? (
            <li className="disabled p-2">
              <span className="loading loading-spinner loading-xs" />
            </li>
          ) : (
            filtered.map((b) => (
              <li key={b.brand}>
                <button
                  onClick={() => {
                    onSelect(b.brand);
                    close();
                  }}
                  className={value === b.brand ? "active" : ""}
                >
                  {value === b.brand && <LuCheck className="w-3.5" />}
                  <span className="truncate">{b.brand}</span>
                  <span className="ml-auto text-xs opacity-40">{b.n}</span>
                </button>
              </li>
            ))
          )}
          {!isLoading && filtered.length === 0 && (
            <li className="p-2 text-sm opacity-50">{t("brand.none")}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
