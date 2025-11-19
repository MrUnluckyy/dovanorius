"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

// Table shape (Supabase `profiles`)
// id, display_name, about, avatar_url, public
interface Profile {
  id: string;
  display_name: string;
  about?: string | null;
  avatar_url?: string | null;
  public: boolean;
}

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
    .split(new RegExp("\\\\s+"))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function SearchUsers() {
  const supabase = useMemo(() => createClient(), []);
  const [term, setTerm] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("profile-search-recent");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const debounced = useDebouncedValue(term, 450);
  const latestQueryRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      "profile-search-recent",
      JSON.stringify(recent.slice(0, 8))
    );
  }, [recent]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 3) {
      setProfiles([]);
      setSearched(false);
      setError(null);
      return;
    }

    const run = async () => {
      const myId = ++latestQueryRef.current; // guard stale responses
      setLoading(true);
      setError(null);

      const like = `%${q}%`;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, about, avatar_url, public")
        .eq("public", true)
        .ilike("display_name", like)
        .order("display_name", { ascending: true })
        .limit(24);

      if (myId !== latestQueryRef.current) return; // ignore stale

      if (error) {
        setError(error.message ?? "Something went wrong");
        setProfiles([]);
      } else {
        setProfiles(data ?? []);
        setSearched(true);
        setRecent((prev) => [q, ...prev.filter((t) => t !== q)].slice(0, 8));
      }
      setLoading(false);
    };

    run();
  }, [debounced, supabase]);

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setTerm((t) => t.trim());
  };

  const clear = () => {
    setTerm("");
    setProfiles([]);
    setSearched(false);
    setError(null);
  };

  return (
    <div className="mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ieškoti vartotojų</h1>
          <p className="text-sm opacity-70">
            Surask žmones pagal jų slapyvardžius
          </p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={onSubmit} className="relative mb-4 ">
        <div className="join">
          <div>
            <label className="input join-item">
              <svg
                className="h-[1em] opacity-50"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <g
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </g>
              </svg>
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Vartotojo vardas"
                aria-label="Search"
                className="grow"
              />
            </label>
          </div>
          <button
            type="submit"
            className={`btn btn-primary join-item ${
              loading ? "btn-disabled" : ""
            }`}
            disabled={term.trim().length < 3 || loading}
          >
            {loading && (
              <span className="loading loading-spinner loading-sm"></span>
            )}
            {!loading && <span>Search</span>}
          </button>
        </div>
      </form>

      {/* Recent chips
      {recent.length > 0 && !searched && (
        <div className="mb-6 flex flex-wrap gap-2">
          {recent.map((t) => (
            <button
              key={t}
              onClick={() => setTerm(t)}
              className="badge badge-ghost cursor-pointer"
            >
              {t}
            </button>
          ))}
        </div>
      )} */}

      {/* Error */}
      {error && (
        <div role="alert" className="alert alert-error mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 shrink-0"
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

      {/* Loading skeletons */}
      {loading && !error && (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card border border-base-300">
              <div className="card-body flex-row items-center gap-4 py-4">
                <div className="skeleton h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
                <div className="skeleton h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && profiles.length === 0 && !error && (
        <div className="card">
          <div className="card-body items-center text-center">
            <h2 className="card-title">Nerasta</h2>
            <p className="opacity-70">Pabandyk kitą vardą</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && profiles.length > 0 && (
        <ul className="grid grid-cols-1 gap-3">
          {profiles.map((p) => (
            <li key={p.id}>
              <div className="card hover:shadow-md border border-base-300 transition">
                <div className="card-body py-4">
                  <div className="flex items-start gap-4">
                    <div className="avatar">
                      <div className="w-12 rounded-full">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.display_name} />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-base-200 font-semibold">
                            {initials(p.display_name)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold leading-none">
                          {p.display_name}
                        </h3>
                        {!p.public && (
                          <span className="badge badge-outline">Privatus</span>
                        )}
                      </div>
                      {p.about && (
                        <p className="mt-1 line-clamp-2 text-sm opacity-70">
                          {p.about}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/users/${p?.id}`}
                        className="btn btn-outline btn-sm"
                      >
                        Atidaryti
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs opacity-70">
        Rezultatai rodo tik viešus profilius.
      </p>
    </div>
  );
}
