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
import { LuSearch } from "react-icons/lu";

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
        // const { data: boards, error: boardsError } = await supabase
        //   .from("boards")
        //   .select("id, name, description, slug")
        //   .ilike("name", like)
        //   .order("name", { ascending: true })
        //   .limit(10);

        // if (boardsError) throw boardsError;

        // const boardResults: SearchResult[] =
        //   (boards ?? []).map((b: Board) => ({
        //     type: "board",
        //     id: b.id,
        //     title: b.name,
        //     subtitle: b.description,
        //     href: `/boards/${b.slug}`,
        //   })) ?? [];

        const boardResults: SearchResult[] = []; // placeholder until boards table is ready

        if (myId !== latestQueryRef.current) return; // stale

        setResults([...profileResults, ...boardResults]);
      } catch (err: any) {
        if (myId !== latestQueryRef.current) return;
        setResults([]);
        setError(err?.message ?? "Something went wrong");
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
    if (e.key === "Escape") {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const shouldShowDropdown =
    open && (loading || error || results.length > 0 || term.trim().length >= 2);

  return (
    <div className="md:relative">
      <form
        onSubmit={onSubmit}
        className="form-control"
        onFocus={() => setOpen(true)}
      >
        <label className="input input-bordered flex items-center gap-2 max-w-xs">
          <LuSearch />
          <input
            type="search"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Ieškoti.."
            aria-label="ieškoti"
            className="grow"
          />
          {loading && (
            <span className="loading loading-spinner loading-xs ml-1" />
          )}
        </label>
      </form>

      {shouldShowDropdown && (
        <div className="absolute left-0 mt-2 w-full md:w-100 max-w-sm rounded-box bg-base-100 shadow-lg border border-base-300 z-50">
          {/* Error */}
          {error && (
            <div className="px-4 py-3 text-sm text-error flex items-start gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
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
            <ul className="menu p-2 max-h-80 overflow-y-auto text-sm">
              {/* Profiles */}
              {results.some((r) => r.type === "profile") && (
                <>
                  <li className="menu-title">
                    <span>Vartotojai</span>
                  </li>
                  {results
                    .filter((r) => r.type === "profile")
                    .map((r) => (
                      <li key={`profile-${r.id}`}>
                        <Link href={r.href} onClick={() => setOpen(false)}>
                          <div className="flex items-center gap-3">
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
                        <Link href={r.href} onClick={() => setOpen(false)}>
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
      )}
    </div>
  );
}
