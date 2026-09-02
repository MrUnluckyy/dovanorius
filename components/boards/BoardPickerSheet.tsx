"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { LuCheck, LuLock, LuPlus, LuSearch, LuX } from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { useBoards } from "@/hooks/useBoards";
import { foldForSearch } from "@/utils/helpers/search";
import { generateSlug } from "@/utils/helpers/slugify";
import { PendingPips } from "@/components/ui/Pending";

export type PickedBoard = { id: string; name: string };

type BoardRow = PickedBoard & {
  item_count?: number | null;
  is_public?: boolean | null;
};

/** Above the picker's own filter, a list is easier to scan than to search. */
const FILTER_THRESHOLD = 6;

function boardInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "•";
}

/**
 * Choose a board to save something into.
 *
 * This replaces a `dropdown dropdown-top`, which put a floating menu over the
 * one button people were reaching for and clipped itself against the modal it
 * lived in. Saving is the whole point of an idea, so it gets a surface of its
 * own: a bottom sheet on a phone (thumb-height, the pattern Pinterest uses for
 * exactly this choice) and a small centred dialog on a desktop.
 *
 * Rendered through a portal because the sheet is `position: fixed` and its
 * caller is usually a modal whose transform would otherwise become the
 * containing block, pinning the sheet inside the modal instead of the viewport.
 */
export function BoardPickerSheet({
  open,
  onClose,
  onPick,
  savingBoardId = null,
  savedBoardIds = [],
}: {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen board — or with a board the user just created. */
  onPick: (board: PickedBoard) => void;
  /** Board currently being written to, so its row can show progress. */
  savingBoardId?: string | null;
  /** Boards this item already sits on. */
  savedBoardIds?: string[];
}) {
  const t = useTranslations("BoardPicker");
  const tb = useTranslations("Boards");
  const queryClient = useQueryClient();

  const { data, isLoading } = useBoards();
  const boards = useMemo(() => (data ?? []) as BoardRow[], [data]);

  const [mounted, setMounted] = useState(false);
  const [render, setRender] = useState(open);
  const [entered, setEntered] = useState(false);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const newNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Mount before the enter transition and stay mounted through the exit one,
  // so the sheet slides both ways instead of appearing and vanishing.
  useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setEntered(true))
      );
      return () => cancelAnimationFrame(id);
    }
    setEntered(false);
    const id = setTimeout(() => setRender(false), 220);
    return () => clearTimeout(id);
  }, [open]);

  // Every open starts from a clean slate.
  useEffect(() => {
    if (!open) return;
    setFilter("");
    setCreating(false);
    setNewName("");
  }, [open]);

  useEffect(() => {
    if (creating) newNameRef.current?.focus();
  }, [creating]);

  // Hold the page still. Nests correctly under a caller that already locked:
  // this restores "hidden", and the caller restores the original value.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes the picker only — the modal underneath keeps its own handler
  // dormant while this is open, so one press peels off one layer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const createBoard = useMutation({
    mutationFn: async (name: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: board, error } = await supabase
        .from("boards")
        .insert({
          owner_id: user.id,
          name,
          description: "",
          is_public: true,
          slug: generateSlug(name),
        })
        .select("id, name")
        .single();
      if (error) throw error;
      return board as PickedBoard;
    },
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setCreating(false);
      setNewName("");
      // Creating a board here is never the goal in itself — the user is midway
      // through saving something, so drop it straight in.
      onPick(board);
    },
    onError: () => toast.error(tb("toastBoardCreateError")),
  });

  const folded = foldForSearch(filter);
  const visibleBoards = folded
    ? boards.filter((b) => foldForSearch(b.name).includes(folded))
    : boards;

  const showFilter = boards.length > FILTER_THRESHOLD;

  if (!mounted || !render) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
    >
      <div
        className={`absolute inset-0 bg-[rgba(35,31,24,0.45)] transition-opacity duration-200 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <div
        className={`relative flex max-h-[82svh] w-full flex-col overflow-hidden rounded-t-[28px] bg-(--nr-surface) shadow-[0_-10px_40px_rgba(35,31,24,0.18)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:max-h-[70vh] sm:max-w-md sm:rounded-[28px] sm:shadow-[var(--nr-shadow-float)] ${
          entered
            ? "translate-y-0 opacity-100 sm:scale-100"
            : "translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95"
        }`}
      >
        {/* Grab handle — the sheet's "you can dismiss me" tell on touch. */}
        <div className="flex justify-center pb-1 pt-2.5 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-(--nr-ink)/15" />
        </div>

        <header className="flex items-center gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <h3 className="font-heading text-lg font-bold tracking-tight">
            {t("title")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tb("ctaClose")}
            className="ml-auto grid h-8 w-8 cursor-pointer place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile) hover:text-(--nr-ink)"
          >
            <LuX className="w-4" />
          </button>
        </header>

        {showFilter && (
          <div className="px-5 pb-2">
            <div className="flex items-center gap-2 rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3 py-2">
              <LuSearch className="w-4 shrink-0 text-(--nr-faint)" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="w-full bg-transparent text-sm outline-none placeholder:text-(--nr-faint)"
              />
            </div>
          </div>
        )}

        {/* Boards */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {isLoading ? (
            <ul className="space-y-1 px-2 py-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <span className="nr-skeleton h-11 w-11 rounded-xl" />
                  <span className="nr-skeleton h-3.5 w-32" />
                </li>
              ))}
            </ul>
          ) : visibleBoards.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-(--nr-muted)">
              {boards.length === 0 ? t("empty") : t("noMatches")}
            </p>
          ) : (
            <ul>
              {visibleBoards.map((b) => {
                const saved = savedBoardIds.includes(b.id);
                const saving = savingBoardId === b.id;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      disabled={savingBoardId != null}
                      onClick={() => onPick({ id: b.id, name: b.name })}
                      className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-(--nr-tile)/55 disabled:cursor-default"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-(--nr-tile) font-heading text-base font-bold text-(--nr-gold-strong)">
                        {boardInitial(b.name)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-semibold leading-tight">
                            {b.name}
                          </span>
                          {b.is_public === false && (
                            <LuLock
                              className="w-3 shrink-0 text-(--nr-faint)"
                              aria-label={tb("private")}
                            />
                          )}
                        </span>
                        <span className="text-xs text-(--nr-faint)">
                          {tb("itemsCount", { count: b.item_count ?? 0 })}
                        </span>
                      </span>

                      {saving ? (
                        <PendingPips />
                      ) : saved ? (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-(--nr-yellow) text-(--nr-ink)">
                          <LuCheck className="w-4" />
                        </span>
                      ) : (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-(--nr-border) text-(--nr-muted) transition group-hover:border-(--nr-yellow) group-hover:bg-(--nr-yellow) group-hover:text-(--nr-ink)">
                          <LuPlus className="w-4" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Create a board without leaving the save you were making. */}
        <div className="shrink-0 border-t border-(--nr-border) px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-3">
          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = newName.trim();
                if (name) createBoard.mutate(name);
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={newNameRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={tb("boardTitle")}
                aria-label={tb("boardTitle")}
                maxLength={60}
                className="min-w-0 flex-1 rounded-[var(--nr-radius-input)] border border-(--nr-border) bg-(--nr-cream) px-3 py-2 text-sm outline-none transition focus:border-(--nr-yellow-deep) placeholder:text-(--nr-faint)"
              />
              <button
                type="submit"
                disabled={!newName.trim() || createBoard.isPending}
                className="nr-btn nr-btn-primary nr-btn-sm shrink-0 disabled:opacity-50"
              >
                {createBoard.isPending ? tb("ctaSaving") : t("create")}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                aria-label={tb("ctaCancel")}
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-(--nr-muted) transition hover:bg-(--nr-tile)"
              >
                <LuX className="w-4" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl py-1 text-left transition hover:opacity-80"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-dashed border-(--nr-border) text-(--nr-muted)">
                <LuPlus className="w-5" />
              </span>
              <span className="font-semibold">{t("newBoard")}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
