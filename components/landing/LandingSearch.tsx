"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LuSearch, LuArrowRight, LuX } from "react-icons/lu";
import { useTranslations } from "next-intl";
import { createClient } from "@/utils/supabase/client";
import { foldForSearch } from "@/utils/helpers/search";

interface Profile {
  id: string;
  display_name: string;
  about?: string | null;
  avatar_url?: string | null;
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Avatar that falls back to initials when the image is missing or fails to load. */
function ResultAvatar({
  url,
  name,
}: {
  url?: string | null;
  name: string;
}) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--nr-tile) text-xs font-bold text-(--nr-gold-strong)">
      {initials(name)}
    </span>
  );
}

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/**
 * Landing search — a subtle trigger by the logo that opens a smooth,
 * spring-animated modal to look up public profiles. Part of the Noriuto
 * design system; the trigger inherits nav-item colours.
 */
export function LandingSearch() {
  const t = useTranslations("Landing.search");
  const supabase = useMemo(() => createClient(), []);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const seq = useRef(0);
  const debounced = useDebounced(term);

  useEffect(() => setMounted(true), []);

  // open/close with enter + exit transitions
  const openModal = () => {
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
  };
  const closeModal = () => {
    setEntered(false);
    setTimeout(() => {
      setOpen(false);
      setTerm("");
      setResults([]);
    }, 220);
  };

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // lock scroll + esc while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // query public profiles
  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, display_name, about, avatar_url")
      .eq("public", true)
      // Folded column + folded term, so "Zyg" finds "Žygimantas".
      .ilike("display_name_norm", `%${foldForSearch(q)}%`)
      .order("display_name", { ascending: true })
      .limit(8)
      .then(({ data }) => {
        if (id !== seq.current) return;
        setResults((data as Profile[]) ?? []);
        setLoading(false);
      });
  }, [debounced, supabase]);

  return (
    <>
      {/* Trigger — inherits nav-item colours */}
      <button
        type="button"
        onClick={openModal}
        aria-label={t("label")}
        className="group flex items-center gap-2 rounded-full px-3 py-1.5 text-[15px] font-medium text-(--nr-muted) transition-colors hover:bg-(--nr-tile)/60 hover:text-(--nr-ink)"
      >
        <LuSearch className="text-[18px]" />
        <span className="hidden lg:inline">{t("label")}</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center">
            {/* backdrop */}
            <button
              aria-label={t("close")}
              onClick={closeModal}
              className="absolute inset-0 cursor-default bg-[rgba(35,31,24,0.28)] backdrop-blur-[3px] transition-opacity duration-200"
              style={{ opacity: entered ? 1 : 0 }}
            />

            {/* panel */}
            <div
              role="dialog"
              aria-modal="true"
              className="relative mt-[14vh] w-[min(560px,92vw)] overflow-hidden rounded-[22px] border border-(--nr-border) bg-white shadow-[0_24px_70px_rgba(35,31,24,0.22)]"
              style={{
                opacity: entered ? 1 : 0,
                transform: entered
                  ? "translateY(0) scale(1)"
                  : "translateY(-10px) scale(0.975)",
                transition:
                  "opacity .22s var(--nr-ease-out-expo), transform .3s var(--nr-ease-spring)",
              }}
            >
              {/* input row */}
              <div className="flex items-center gap-2 border-b border-(--nr-border) px-4 py-3.5">
                <LuSearch className="ml-1 shrink-0 text-[20px] text-(--nr-faint)" />
                <input
                  ref={inputRef}
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder={t("placeholder")}
                  aria-label={t("label")}
                  className="nr-search-input w-full bg-transparent text-[16px] text-(--nr-ink) outline-none placeholder:text-(--nr-faint)"
                />
                {loading && (
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-(--nr-border) border-t-(--nr-yellow-deep)" />
                )}
                {/* modal close */}
                <button
                  type="button"
                  aria-label={t("close")}
                  onClick={closeModal}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--nr-muted) transition-colors hover:bg-(--nr-tile) hover:text-(--nr-ink)"
                >
                  <LuX className="text-[18px]" />
                </button>
              </div>

            {/* results */}
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {term.trim().length < 2 && (
                <p className="px-3 py-6 text-center text-[13.5px] text-(--nr-faint)">
                  {t("hint")}
                </p>
              )}
              {term.trim().length >= 2 && !loading && results.length === 0 && (
                <p className="px-3 py-6 text-center text-[13.5px] text-(--nr-faint)">
                  {t("empty")}
                </p>
              )}
              {results.map((p) => (
                <Link
                  key={p.id}
                  href={`/users/${p.id}`}
                  onClick={closeModal}
                  className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-(--nr-tile)/70"
                >
                  <ResultAvatar url={p.avatar_url} name={p.display_name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-(--nr-ink)">
                      {p.display_name}
                    </span>
                    {p.about && (
                      <span className="block truncate text-[12.5px] text-(--nr-faint)">
                        {p.about}
                      </span>
                    )}
                  </span>
                  <LuArrowRight className="shrink-0 text-(--nr-faint) opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>

            <div className="border-t border-(--nr-border) px-4 py-2 text-[11px] text-(--nr-faint)">
              {t("footer")}
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
