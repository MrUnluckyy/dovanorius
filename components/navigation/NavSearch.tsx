"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
  KeyboardEvent,
} from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { SearchInput } from "../search/SearchInput";

// Table shape (Supabase `profiles`)
interface Profile {
  id: string;
  display_name: string;
  about?: string | null;
  avatar_url?: string | null;
  public: boolean;
}

// Future shape (Supabase `boards`)
interface Board {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
}

type SearchResult =
  | {
      type: "profile";
      id: string;
      title: string;
      subtitle?: string | null;
      avatarUrl?: string | null;
      href: string;
      isPublic: boolean;
    }
  | {
      type: "board";
      id: string;
      title: string;
      subtitle?: string | null;
      avatarUrl?: string | null;
      href: string;
    };

function useDebouncedValue<T>(value: T, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
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

export function NavSearch() {
  const supabase = useMemo(() => createClient(), []);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const latestQueryRef = useRef(0);
  const debounced = useDebouncedValue(term, 300);

  // ✅ separate refs (never share one ref across 2 inputs)
  const smallInputRef = useRef<HTMLInputElement | null>(null);
  const overlayInputRef = useRef<HTMLInputElement | null>(null);

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      overlayInputRef.current?.blur();
      smallInputRef.current?.blur();
    }, 0);
  };

  // ✅ lock scroll when overlay open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ✅ focus overlay input when opened
  useEffect(() => {
    if (open) setTimeout(() => overlayInputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const run = async () => {
      const myId = ++latestQueryRef.current;
      setLoading(true);
      setError(null);

      try {
        const like = `%${q}%`;

        // 1) Profiles
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, about, avatar_url, public")
          .eq("public", true)
          .ilike("display_name", like)
          .order("display_name", { ascending: true })
          .limit(10);

        if (profileError) throw profileError;

        const profileResults: SearchResult[] =
          (profiles ?? []).map((p: Profile) => ({
            type: "profile",
            id: p.id,
            title: p.display_name,
            subtitle: p.about,
            avatarUrl: p.avatar_url ?? undefined,
            href: `/users/${p.id}`,
            isPublic: p.public,
          })) ?? [];

        // 2) Boards – plug in when ready
        const boardResults: SearchResult[] = [];

        if (myId !== latestQueryRef.current) return; // stale

        setResults([...profileResults, ...boardResults]);
      } catch (err) {
        if (myId !== latestQueryRef.current) return;
        setResults([]);
        setError("Something went wrong");
      } finally {
        if (myId === latestQueryRef.current) {
          setLoading(false);
        }
      }
    };

    run();
  }, [debounced, supabase]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTerm((t) => t.trim());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") close();
  };

  const shouldShowDropdown =
    open && (loading || error || results.length > 0 || term.trim().length >= 2);

  const ResultsDropdown = ({ className = "" }: { className?: string }) =>
    shouldShowDropdown ? (
      <div
        className={[
          "mt-2 w-full rounded-box bg-base-100 shadow-lg border border-base-300 z-50",
          className,
        ].join(" ")}
      >
        {/* Error */}
        {error && (
          <div className="px-4 py-3 text-sm text-error flex items-start gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* Hint */}
        {!error && term.trim().length < 2 && (
          <div className="px-4 py-3 text-xs opacity-70">
            Turi būti įvesti bent 2 simbolius paieškai
          </div>
        )}

        {/* Loading state */}
        {loading && !error && (
          <ul className="menu p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i}>
                <div className="flex items-center gap-3">
                  <div className="skeleton h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="skeleton h-3 w-1/2" />
                    <div className="skeleton h-3 w-1/3" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Results */}
        {!loading && !error && results.length > 0 && (
          <ul className="menu p-2 max-h-[60vh] overflow-y-auto text-sm w-full">
            {/* Profiles */}
            {results.some((r) => r.type === "profile") && (
              <>
                <li className="menu-title">
                  <span>Vartotojai</span>
                </li>
                {results
                  .filter((r) => r.type === "profile")
                  .map((r) => (
                    <li key={`profile-${r.id}`} className="w-full">
                      <Link href={r.href} onClick={close} className="w-full">
                        <div className="flex items-center gap-3 w-full">
                          <div className="avatar">
                            <div className="w-8 rounded-full">
                              {r.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={r.avatarUrl}
                                  alt={r.title}
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-base-200 text-xs font-semibold">
                                  {initials(r.title)}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{r.title}</p>
                            {r.subtitle && (
                              <p className="truncate text-xs opacity-70">
                                {r.subtitle}
                              </p>
                            )}
                          </div>
                          {"isPublic" in r && !r.isPublic && (
                            <span className="badge badge-outline badge-xs ml-auto">
                              Privatus
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
              </>
            )}

            {/* Boards (future) */}
            {results.some((r) => r.type === "board") && (
              <>
                <li className="menu-title mt-1">
                  <span>Lentos</span>
                </li>
                {results
                  .filter((r) => r.type === "board")
                  .map((r) => (
                    <li key={`board-${r.id}`}>
                      <Link href={r.href} onClick={close}>
                        <div className="flex items-center gap-3">
                          <div className="avatar placeholder">
                            <div className="w-8 rounded-full bg-base-200">
                              <span className="text-xs">B</span>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{r.title}</p>
                            {r.subtitle && (
                              <p className="truncate text-xs opacity-70">
                                {r.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
              </>
            )}
          </ul>
        )}

        {/* Empty state */}
        {!loading &&
          !error &&
          term.trim().length >= 2 &&
          results.length === 0 && (
            <div className="px-4 py-3 text-sm opacity-70">
              Rezultatų nerasta. Pabandykite kitą paieškos terminą.
            </div>
          )}

        <div className="px-4 py-2 border-t border-base-200 text-[10px] opacity-60">
          Rezultatai rodo tik viešus profilius.
        </div>
      </div>
    ) : null;

  return (
    <div className="md:relative">
      {/* ✅ render small input ONLY when overlay is closed */}
      {!open && (
        <>
          <SearchInput
            loading={loading}
            term={term}
            onKeyDown={onKeyDown}
            onSubmit={onSubmit}
            setTerm={setTerm}
            onOpen={setOpen}
            variant="small"
            inputRef={smallInputRef}
          />
          {/* optional: desktop dropdown positioning if you ever want it without overlay */}
        </>
      )}

      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop (use div + onMouseDown so it doesn't steal focus) */}
          <div className="absolute inset-0 bg-black/40" onMouseDown={close} />

          {/* Panel */}
          <div className="relative mx-auto w-full max-w-2xl px-4 pt-6">
            <div className="rounded-box bg-base-100 shadow-xl border border-base-300 p-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <SearchInput
                    loading={loading}
                    term={term}
                    onKeyDown={onKeyDown}
                    onSubmit={onSubmit}
                    setTerm={setTerm}
                    onOpen={setOpen}
                    variant="overlay"
                    inputRef={overlayInputRef}
                  />
                </div>
                <button type="button" className="btn btn-ghost" onClick={close}>
                  Uždaryti
                </button>
              </div>

              <ResultsDropdown />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
