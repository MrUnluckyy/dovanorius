"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import {
  LuX,
  LuExternalLink,
  LuPlus,
  LuCheck,
  LuSparkles,
  LuFlag,
} from "react-icons/lu";
import { createClient } from "@/utils/supabase/client";
import { useAddIdeaToBoard } from "@/hooks/useAddIdeaToBoard";
import {
  BoardPickerSheet,
  type PickedBoard,
} from "@/components/boards/BoardPickerSheet";
import { trackInspo } from "@/utils/trackInspo";
import type { CardProduct } from "./ProductCard";

const ISSUES = ["wrong_category", "wrong_gender", "not_a_gift"] as const;

export function ProductModal({
  product,
  userId,
  onClose,
}: {
  product: CardProduct | null;
  userId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("Discover");
  const tInspo = useTranslations("Inspo");
  const addToBoard = useAddIdeaToBoard();
  const [savedBoardIds, setSavedBoardIds] = useState<string[]>([]);
  const [savingBoardId, setSavingBoardId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [entered, setEntered] = useState(false);

  // Reset transient state whenever a different product opens.
  useEffect(() => {
    setSavedBoardIds([]);
    setSavingBoardId(null);
    setPickerOpen(false);
    setReportOpen(false);
    setReported(false);
  }, [product?.id]);

  // Play the sheet in, and back out again before the parent drops it.
  useEffect(() => {
    if (!product) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [product]);

  const close = useCallback(() => {
    setEntered(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Close on Escape — unless the board picker is open, which owns the key while
  // it is up so one press closes one layer.
  useEffect(() => {
    if (!product || pickerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product, pickerOpen, close]);

  // Hold the page still behind the sheet. Without this, a scroll gesture that
  // starts on the modal's padding drags the feed underneath instead.
  useEffect(() => {
    if (!product) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [product]);

  if (!product) return null;

  const discount =
    product.discountPct != null &&
    product.discountPct >= 5 &&
    product.discountPct <= 85
      ? Math.round(product.discountPct)
      : null;
  const showRrp =
    discount != null && product.rrp != null && product.rrp > (product.price ?? 0);

  const handlePick = (board: PickedBoard) => {
    if (savedBoardIds.includes(board.id)) {
      setPickerOpen(false);
      return;
    }
    setSavingBoardId(board.id);
    addToBoard.mutate(
      {
        boardId: board.id,
        title: product.title,
        url: product.deepLink,
        imageUrl: product.imageUrl,
        price: product.price,
        notes: product.reason ?? null,
      },
      {
        onSuccess: () => {
          setSavedBoardIds((ids) => [...ids, board.id]);
          trackInspo("save", product.id);
          toast.success(tInspo("addedToBoard", { board: board.name }));
          setPickerOpen(false);
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : tInspo("addError")),
        onSettled: () => setSavingBoardId(null),
      }
    );
  };

  const submitReport = async (issue: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("inspo_corrections")
      .insert({ product_id: product.id, user_id: userId, issue });
    if (error) {
      toast.error(tInspo("addError"));
      return;
    }
    setReported(true);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
        onClick={close}
        role="dialog"
        aria-modal="true"
        aria-label={product.title}
      >
        <div
          className={`absolute inset-0 bg-[rgba(35,31,24,0.5)] backdrop-blur-[2px] transition-opacity duration-200 ${
            entered ? "opacity-100" : "opacity-0"
          }`}
        />

        {/*
          Height is budgeted, not left to the content: the picture is capped so
          the price and the two buttons are on screen the moment the sheet
          opens. Before this the image claimed a 4:5 slice of the viewport
          width — 490px on a phone — and pushed everything that matters below
          the fold, so the sheet opened on a product shot and nothing else.
        */}
        <div
          className={`relative flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] bg-base-100 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:max-h-[88vh] sm:rounded-[28px] md:flex-row ${
            entered
              ? "translate-y-0 opacity-100 sm:scale-100"
              : "translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pb-1 pt-2.5 md:hidden">
            <span className="h-1 w-9 rounded-full bg-(--nr-ink)/15" />
          </div>

          <button
            onClick={close}
            aria-label={t("close")}
            className="absolute right-3 top-3 z-10 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-base-100/80 text-(--nr-ink) backdrop-blur transition hover:bg-base-200"
          >
            <LuX className="w-5" />
          </button>

          {/* Image */}
          <div className="relative flex h-[clamp(160px,28svh,280px)] shrink-0 items-center justify-center border-b border-(--nr-border) bg-white md:h-auto md:min-h-[24rem] md:w-1/2 md:border-b-0 md:border-r">
            <img
              src={product.imageUrl ?? "/assets/placeholder.jpg"}
              alt={product.title}
              className="h-full w-full object-contain p-4 md:p-8"
              onError={(e) => {
                e.currentTarget.src = "/assets/placeholder.jpg";
              }}
            />
          </div>

          {/* Details */}
          <div className="flex min-h-0 flex-1 flex-col md:w-1/2">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 md:px-7 md:py-7">
              <div>
                {product.brand && (
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-55">
                    {product.brand}
                  </p>
                )}
                <h2 className="mt-1 font-heading text-xl font-bold leading-snug tracking-tight">
                  {product.title}
                </h2>
              </div>

              {/* The one place a saving is worth stating: this is where someone
                  decides to buy. Phrased as information ("was X, now Y") rather
                  than a shouted badge — the point is a useful fact at the right
                  moment, not urgency. */}
              <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-2xl font-bold tracking-tight">
                  {product.price != null ? `${product.price} €` : "—"}
                </span>
                {showRrp && (
                  <>
                    <span className="text-sm line-through opacity-40">
                      {product.rrp} €
                    </span>
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                      {t("priceDropped", { percent: discount ?? 0 })}
                    </span>
                  </>
                )}
              </div>

              {product.reason && (
                <div className="mt-4 flex gap-2 rounded-2xl bg-primary/10 p-3 text-sm">
                  <LuSparkles className="mt-0.5 w-4 shrink-0 text-primary" />
                  <p className="italic leading-snug">{product.reason}</p>
                </div>
              )}

              {/* Item correction */}
              {userId && (
                <div className="mt-5 border-t border-base-200 pt-3">
                  {reported ? (
                    <p className="flex items-center gap-2 text-sm opacity-60">
                      <LuCheck className="w-4 text-success" />
                      {t("report.thanks")}
                    </p>
                  ) : reportOpen ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs opacity-60">
                        {t("report.prompt")}
                      </span>
                      {ISSUES.map((issue) => (
                        <button
                          key={issue}
                          onClick={() => submitReport(issue)}
                          className="cursor-pointer rounded-full bg-base-200 px-3 py-1 text-xs transition hover:bg-base-300"
                        >
                          {t(`report.${issue}`)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => setReportOpen(true)}
                      className="flex cursor-pointer items-center gap-1.5 text-xs opacity-50 transition hover:opacity-90"
                    >
                      <LuFlag className="w-3.5" />
                      {t("report.cta")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Actions sit outside the scroll area — the two things anyone opens
                this sheet to do stay put however long the title runs. */}
            <div className="shrink-0 border-t border-(--nr-border) bg-base-100 px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-3 md:px-7 md:pb-6">
              <div className="flex flex-col gap-2">
                {product.deepLink && (
                  <a
                    href={product.deepLink}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    onClick={() => trackInspo("click_out", product.id)}
                    className="btn btn-neutral w-full gap-2 rounded-full"
                  >
                    <LuExternalLink className="w-4" />
                    {tInspo("viewInStore")}
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="btn btn-outline btn-neutral w-full cursor-pointer gap-2 rounded-full"
                >
                  {savedBoardIds.length > 0 ? (
                    <>
                      <LuCheck className="w-4" />
                      {tInspo("added")}
                    </>
                  ) : (
                    <>
                      <LuPlus className="w-4" />
                      {tInspo("addToBoard")}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BoardPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePick}
        savingBoardId={savingBoardId}
        savedBoardIds={savedBoardIds}
      />
    </>
  );
}
