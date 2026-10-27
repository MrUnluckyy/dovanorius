"use client";

import { useProductImageUpload } from "@/hooks/useImageUpload";
import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ItemFormValues, ItemSchema } from "@/schemas/ItemSchema";
import toast from "react-hot-toast";
import { stripHtml } from "@/utils/helpers/stripHtml";
import { useEffect, useRef, useState } from "react";
import { useCurrentBoardId } from "@/hooks/useCurrentBoardId";
import { useBoards } from "@/hooks/useBoards";
import { ImageUploadGrid, ImageSlot } from "@/components/ui/ImageUploadGrid";
import { Hero3D } from "@/components/ui/Hero3D";
import { BoardForm } from "./BoardForm";
import { reportError } from "@/lib/report";
import { trackWishCreated } from "@/lib/analytics";
import {
  LuArrowLeft,
  LuArrowRight,
  LuChevronDown,
  LuLink,
  LuPencilLine,
} from "react-icons/lu";

type WishFormProps = {
  onCancel: () => void;
  onSuccess?: () => void;
  /** Adding from inside a board: no board picker, the wish goes there. */
  fixedBoardId?: string;
  /** Pasted elsewhere (the dashboard bar): fetch it straight away. */
  initialUrl?: string;
  /** "Enter by hand" chosen before opening: skip the link step. */
  startManual?: boolean;
};

type Step = "start" | "fetching" | "details";

/**
 * The one "add a wish" flow — the create menu and a board's "Add wish" button
 * both render it (they used to be two copy-pasted forms that drifted).
 *
 * Step 1 asks the only question that changes the work: do you have a link?
 * Pasting one fetches the photo, name and price straight away; "Enter by hand"
 * skips to an empty form. Step 2 shows what will be saved, with only title,
 * price, board and photos up front — notes, the link and "infinite" sit under
 * "More options", because most wishes never touch them.
 *
 * The edit form (boards/[boardId]/components/ItemForm.tsx) is separate and
 * shares the overflow fix: `min-w-0 grid-cols-[minmax(0,1fr)]` on fieldsets
 * and `min-w-0 whitespace-normal` on the toggle hint.
 */
export function WishForm({
  onCancel,
  onSuccess,
  fixedBoardId,
  initialUrl,
  startManual = false,
}: WishFormProps) {
  const t = useTranslations("Wish");
  const tb = useTranslations("Boards");
  const supabase = createClient();
  const queryClient = useQueryClient();
  const routeBoardId = useCurrentBoardId();
  const { uploadMultipleProductImages } = useProductImageUpload();
  const { data: boards = [], isLoading: boardsLoading } = useBoards();

  const [step, setStep] = useState<Step>(startManual ? "details" : "start");
  const [fetchFailed, setFetchFailed] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  /** Whether this wish started from a pasted link (vs. typed by hand). */
  const fromLinkRef = useRef(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState,
    getValues,
    setValue,
    watch,
  } = useForm<ItemFormValues>({
    defaultValues: {
      title: "",
      url: "",
      notes: "",
      image_url: "",
      price: undefined,
      boardId: fixedBoardId || routeBoardId || "",
      is_infinite: false,
    },
    resolver: zodResolver(ItemSchema),
    mode: "onSubmit",
  });

  const parsedImageUrl = watch("image_url");
  const url = watch("url");
  const boardId = watch("boardId");

  // Opened outside a board: preselect the most recently used one. An empty
  // boardId failed the uuid check, so "Save" silently did nothing.
  useEffect(() => {
    if (!boardId && boards.length > 0) setValue("boardId", boards[0].id);
  }, [boardId, boards, setValue]);

  const slots: ImageSlot[] = [
    ...(parsedImageUrl ? [{ url: parsedImageUrl, isNew: false }] : []),
    ...previewUrls.map((u) => ({ url: u, isNew: true })),
  ];

  useEffect(() => {
    const urls = pendingFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingFiles]);

  useEffect(() => {
    if (step === "details") titleRef.current?.focus();
  }, [step]);

  // Mount-only: the link arrived with the open, so the first screen is the fetch.
  const startedWith = useRef(false);
  useEffect(() => {
    if (startedWith.current || !initialUrl?.trim()) return;
    startedWith.current = true;
    fetchFromLink(initialUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = (file: File) => {
    if (slots.length >= 5) return;
    setPendingFiles((prev) => [...prev, file]);
  };

  const handleRemove = (index: number) => {
    const parsedOffset = parsedImageUrl ? 1 : 0;
    if (index < parsedOffset) {
      setValue("image_url", "");
    } else {
      const fileIndex = index - parsedOffset;
      setPendingFiles((prev) => prev.filter((_, i) => i !== fileIndex));
    }
  };

  const fetchFromLink = async (raw?: string) => {
    const link = (raw ?? getValues("url") ?? "").trim();
    if (!link) return;
    fromLinkRef.current = true;
    setValue("url", link);
    setFetchFailed(false);
    setStep("fetching");

    try {
      const res = await fetch(`/api/parser?url=${encodeURIComponent(link)}`);
      if (!res.ok) throw new Error(`parser ${res.status}`);
      const data = await res.json();

      // Shorteners and share wrappers (share.google, etc.) resolve server-side
      // via redirect: "follow". Store the RESOLVED url, not the wrapper — /out
      // matches merchants by hostname, so a share.google link would resolve to
      // no merchant and silently lose affiliate attribution.
      if (data?.url && data.url !== link) setValue("url", data.url);

      if (data?.title) setValue("title", data.title);
      if (data?.description) setValue("notes", stripHtml(data.description));
      if (data?.images && data.images.length > 0) {
        setValue("image_url", data.images[0]);
      }
      // The parser already normalises "2 429,50 €" / "$2,429.50" / "1.234,56"
      // into a plain "2429.5" — re-swapping separators here corrupted those.
      const parsedPrice = Number(data?.price);
      if (Number.isFinite(parsedPrice) && parsedPrice > 0) {
        setValue("price", parsedPrice);
      }
      if (!data?.title) setFetchFailed(true);
    } catch {
      // Not an error worth a toast: many shops block bots. The link is kept
      // and the person finishes by hand.
      setFetchFailed(true);
    } finally {
      setStep("details");
    }
  };

  const goManual = () => {
    setValue("url", "");
    setFetchFailed(false);
    setShowMore(false);
    setStep("details");
  };

  const goBack = () => {
    reset({ ...getValues(), title: "", notes: "", image_url: "", price: undefined });
    setPendingFiles([]);
    setFetchFailed(false);
    fromLinkRef.current = false;
    setStep("start");
  };

  const addItem = useMutation({
    mutationFn: async (payload: ItemFormValues) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("items")
        .insert({
          board_id: payload.boardId,
          title: payload.title,
          url: payload.url || null,
          image_url: payload.image_url || null,
          notes: payload.notes || null,
          created_by: user.id,
          price: payload.price || null,
          is_reservable: !payload.is_infinite,
          status: "wanted",
          priority: "medium",
        })
        .select()
        .single();

      if (error) throw error;

      // Files are already HEIC-converted + compressed at pick time (grid).
      let uploadedUrls: string[] = [];
      if (pendingFiles.length > 0) {
        uploadedUrls = await uploadMultipleProductImages(pendingFiles, data.id);
      }

      // Final image_urls: parsed URL first, then uploads.
      const parsedUrl = payload.image_url || null;
      const finalUrls = [
        ...(parsedUrl ? [parsedUrl] : []),
        ...uploadedUrls,
      ].slice(0, 5);

      trackWishCreated({
        source: fromLinkRef.current ? "link" : "manual",
        boardId: payload.boardId,
        hasUrl: !!payload.url,
        hasImage: finalUrls.length > 0 || !!payload.image_url,
        hasPrice: !!payload.price,
      });

      if (finalUrls.length > 0) {
        const { error: updateError } = await supabase
          .from("items")
          .update({
            image_urls: finalUrls,
            image_url: finalUrls[0],
          })
          .eq("id", data.id);

        if (updateError) {
          console.error("Error updating item with image URLs:", updateError);
        }
      }
    },
    onSuccess: () => {
      toast.success(tb("toastItemAdded", { item: getValues("title") }));
      // Prefix match: every board's list, plus board cards' counts/previews.
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      reset();
      setPendingFiles([]);
      fromLinkRef.current = false;
      onSuccess?.();
    },
    onError: (error) => {
      reportError({
        area: "board",
        reason: "wish_create_failed",
        detail: { message: String(error) },
      });
      toast.error(t("saveFailed"));
    },
  });

  const cancel = () => {
    reset();
    setPendingFiles([]);
    onCancel();
  };

  const host = (() => {
    try {
      return url ? new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "") : "";
    } catch {
      return "";
    }
  })();

  const needsBoard = !fixedBoardId && !boardsLoading && boards.length === 0;

  // ── Step 1: link or by hand ─────────────────────────────────────────────
  if (step === "start") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          fetchFromLink();
        }}
        className="min-w-0"
      >
        <div className="flex flex-col items-center text-center">
          <Hero3D name="gift" size={72} />
          <h3 className="font-heading mt-2 text-2xl font-bold">{t("newTitle")}</h3>
          <p className="mt-1 max-w-sm text-sm text-(--nr-muted)">{t("linkHint")}</p>
        </div>

        <label htmlFor="wish-link" className="sr-only">
          {t("linkLabel")}
        </label>
        <div className="mt-5 flex min-w-0 items-center gap-2 rounded-2xl border-2 border-(--nr-border) bg-(--nr-surface) p-1.5 pl-3.5 transition focus-within:border-(--nr-yellow-deep)">
          <LuLink className="w-4 shrink-0 text-(--nr-muted)" aria-hidden />
          <input
            id="wish-link"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoFocus
            placeholder={t("linkPlaceholder")}
            className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-(--nr-faint)"
            {...register("url")}
            // A paste is the whole intent: fetch without a second click.
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text").trim();
              if (/^(https?:\/\/|www\.)\S+$/i.test(pasted)) {
                e.preventDefault();
                fetchFromLink(pasted);
              }
            }}
          />
          <button
            type="submit"
            disabled={!url?.trim()}
            className="btn btn-primary btn-sm h-10 shrink-0 rounded-xl px-4"
          >
            {t("linkCta")}
            <LuArrowRight className="w-4" />
          </button>
        </div>

        <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-(--nr-muted)">
          <span className="h-px flex-1 bg-(--nr-border)" />
          {t("or")}
          <span className="h-px flex-1 bg-(--nr-border)" />
        </div>

        <button
          type="button"
          onClick={goManual}
          className="group flex w-full items-center gap-3 rounded-2xl border border-(--nr-border) bg-(--nr-surface) p-3.5 text-left transition hover:border-(--nr-yellow-deep) hover:bg-(--nr-tile)/50"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-(--nr-tile) text-(--nr-gold-strong)">
            <LuPencilLine className="w-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{t("manualCta")}</span>
            <span className="text-sm text-(--nr-muted)">{t("manualHint")}</span>
          </span>
          <LuArrowRight className="ml-auto w-4 shrink-0 text-(--nr-muted) transition group-hover:translate-x-0.5" />
        </button>

        <div className="mt-6 text-center">
          <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>
            {tb("ctaCancel")}
          </button>
        </div>
      </form>
    );
  }

  // ── Fetching: a preview-shaped skeleton, so the next screen isn't a jump ──
  if (step === "fetching") {
    return (
      <div className="min-w-0" aria-busy="true" aria-live="polite">
        <div className="flex gap-4 rounded-2xl border border-(--nr-border) bg-(--nr-surface) p-3">
          <span className="nr-skeleton h-24 w-24 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col justify-center gap-2.5">
            <span className="nr-skeleton h-3 w-24" />
            <span className="nr-skeleton h-4 w-full" />
            <span className="nr-skeleton h-4 w-2/3" />
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-(--nr-muted)">{t("fetching")}</p>
      </div>
    );
  }

  // ── Step 2: what will be saved ──────────────────────────────────────────
  if (creatingBoard) {
    return (
      <BoardForm
        onCancel={() => setCreatingBoard(false)}
        onSuccess={(board) => {
          setValue("boardId", board.id);
          setCreatingBoard(false);
        }}
      />
    );
  }

  const { ref: titleRegisterRef, ...titleField } = register("title");

  return (
    <form
      onSubmit={handleSubmit((data) => addItem.mutate(data))}
      className="min-w-0 space-y-4"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label={t("back")}
          className="btn btn-ghost btn-sm btn-circle -ml-2"
        >
          <LuArrowLeft className="w-4" />
        </button>
        <h3 className="font-heading text-xl font-bold">{t("newTitle")}</h3>
        {host && (
          <span className="ml-auto truncate rounded-full bg-(--nr-tile) px-2.5 py-1 text-xs font-semibold text-(--nr-gold-strong)">
            {t("fromHost", { host })}
          </span>
        )}
      </div>

      {fetchFailed && (
        <div role="status" className="alert alert-warning py-2.5 text-sm">
          {t("fetchFailed")}
        </div>
      )}

      <fieldset className="fieldset w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
          <div className="min-w-0">
            <label className="label mb-1" htmlFor="wish-title">
              <span className="font-semibold text-base-content">{tb("title")}</span>
            </label>
            <input
              id="wish-title"
              type="text"
              className="input w-full"
              placeholder={t("titlePlaceholder")}
              {...titleField}
              ref={(el) => {
                titleRegisterRef(el);
                titleRef.current = el;
              }}
            />
            {formState.errors.title && (
              <p className="text-sm text-error mt-1">{formState.errors.title.message}</p>
            )}
          </div>
          <div className="min-w-0">
            <label className="label mb-1" htmlFor="wish-price">
              <span className="font-semibold text-base-content">{tb("price")}</span>
            </label>
            <label className="input w-full">
              <input
                id="wish-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder={t("pricePlaceholder")}
                className="min-w-0"
                {...register("price", {
                  setValueAs: (value) => {
                    if (value === "" || value === null || value === undefined) {
                      return undefined;
                    }
                    const n = Number(value);
                    return Number.isNaN(n) ? undefined : n;
                  },
                })}
              />
              <span className="text-(--nr-muted)">€</span>
            </label>
          </div>
          {formState.errors.price && (
            <p className="col-span-2 text-sm text-error">{formState.errors.price.message}</p>
          )}
        </div>

        {!fixedBoardId && (
          <div className="min-w-0">
            <label className="label mb-1" htmlFor="wish-board">
              <span className="font-semibold text-base-content">{tb("board")}</span>
            </label>
            {needsBoard ? (
              <div className="flex flex-col items-start gap-2 rounded-2xl bg-(--nr-tile) p-3.5 text-sm">
                <span className="whitespace-normal">{t("noBoards")}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setCreatingBoard(true)}
                >
                  {tb("ctaCreateBoard")}
                </button>
              </div>
            ) : (
              <select
                id="wish-board"
                disabled={boardsLoading}
                className="select w-full"
                {...register("boardId")}
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="min-w-0">
          <span className="label mb-1">
            <span className="font-semibold text-base-content">{t("photos")}</span>
          </span>
          <ImageUploadGrid
            slots={slots}
            onAdd={handleAdd}
            onRemove={handleRemove}
            maxImages={5}
          />
          <p className="mt-1.5 text-xs text-(--nr-muted)">{t("photosHint")}</p>
        </div>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="flex items-center gap-1.5 self-start text-sm font-semibold text-base-content hover:underline"
        >
          <LuChevronDown
            className={`w-4 transition ${showMore ? "rotate-180" : ""}`}
          />
          {t("more")}
        </button>

        {showMore && (
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
            <div className="min-w-0">
              <label className="label mb-1" htmlFor="wish-notes">
                <span className="font-semibold text-base-content">{tb("notes")}</span>
              </label>
              <textarea
                id="wish-notes"
                rows={3}
                className="textarea w-full"
                placeholder={t("notesPlaceholder")}
                {...register("notes")}
              />
              {formState.errors.notes && (
                <p className="text-sm text-error mt-1">{formState.errors.notes.message}</p>
              )}
            </div>

            <div className="min-w-0">
              <label className="label mb-1" htmlFor="wish-url">
                <span className="font-semibold text-base-content">{t("urlOptional")}</span>
              </label>
              <input
                id="wish-url"
                type="text"
                inputMode="url"
                className="input w-full min-w-0"
                placeholder="https://"
                {...register("url")}
              />
              {formState.errors.url && (
                <p className="text-sm text-error mt-1">{formState.errors.url.message}</p>
              )}
            </div>

            <label className="label cursor-pointer items-start gap-3 justify-start">
              <input
                type="checkbox"
                className="toggle toggle-primary mt-1"
                {...register("is_infinite")}
              />
              <span className="flex min-w-0 flex-col whitespace-normal text-left">
                <span className="font-semibold text-base-content">{tb("infiniteLabel")}</span>
                <span className="text-sm text-(--nr-muted)">{tb("infiniteHint")}</span>
              </span>
            </label>
          </div>
        )}
      </fieldset>

      <div className="modal-action mt-2">
        <button type="button" className="btn btn-ghost" onClick={cancel}>
          {tb("ctaCancel")}
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={addItem.isPending || needsBoard}
          data-busy={addItem.isPending || undefined}
        >
          {addItem.isPending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
