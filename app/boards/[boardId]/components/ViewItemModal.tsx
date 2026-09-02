"use client";

import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { LuExternalLink, LuPencil, LuTrash2, LuX } from "react-icons/lu";
import { Item } from "./WishList";
import { User } from "@supabase/supabase-js";
import { ItemForm } from "./ItemForm";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { useReserveItem } from "@/hooks/useReserveItem";
import { ReserveForm } from "./ReserveForm";
import { ARCHIVE_KEY, useRevertPurchase } from "@/hooks/useArchive";

export function ViewItemModal({
  item,
  inPublicBoard,
  user,
  boardName,
  shareToken,
  getCaptchaToken,
  resetCaptcha,
  triggerClassName = "btn btn-sm btn-primary",
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  item: Item;
  inPublicBoard?: boolean;
  user?: User | null;
  boardName?: string | null;
  shareToken?: string | null;
  getCaptchaToken?: () => Promise<string | undefined>;
  resetCaptcha?: () => void;
  triggerClassName?: string;
  // Optional controlled mode: let a parent (e.g. a clickable card) drive the
  // modal's open state and hide the built-in trigger button.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const { title, notes, price, url, id } = item;
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [isEditing, setIsEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reserveOpen, setReserveOpen] = useState(false);

  // Tall images can hide the details below the fold with no cue to scroll.
  // Show a subtle bottom fade whenever the content area is scrollable.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollCue, setShowScrollCue] = useState(false);
  const updateScrollCue = () => {
    const el = scrollRef.current;
    setShowScrollCue(
      !!el && el.scrollHeight - el.scrollTop - el.clientHeight > 8
    );
  };

  const images =
    item.image_urls?.length
      ? item.image_urls
      : item.image_url
      ? [item.image_url]
      : [];
  const t = useTranslations("Boards");
  const confirm = useConfirm();

  const supabase = createClient();
  const queryClient = useQueryClient();

  const { reserve, unreserve, isPending, needsEmail } = useReserveItem({
    itemId: id,
    boardId: item.board_id,
    user,
    getCaptchaToken,
    resetCaptcha,
    shareToken,
  });

  const revertPurchase = useRevertPurchase(item.board_id);

  const isMyReservation =
    item.status === "reserved" && item.reserved_by === user?.id;

  // Infinite ("unlimited") wish: can be given many times, never reserved.
  const isInfinite = item.is_reservable === false;

  // Run open side-effects whenever the modal opens — works for both the
  // built-in trigger and a parent (clickable card) opening it in controlled mode.
  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(0);
    // Renew-on-activity: opening your own hold pushes the check-in date out,
    // so we don't ask "still planning to give this?" of someone who plainly is.
    if (inPublicBoard && isMyReservation) {
      supabase
        .rpc("renew_reservation", { p_item_id: id })
        .then(({ data }) => {
          if (data) {
            queryClient.invalidateQueries({
              queryKey: ["items", item.board_id],
            });
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Re-measure the scroll cue after the layout settles (open, image swap, mode).
  useEffect(() => {
    const raf = requestAnimationFrame(updateScrollCue);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeIndex, isEditing, notes]);

  const closeModal = () => {
    setIsOpen(false);
    setIsEditing(false);
    setReserveOpen(false);
  };

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast(t("successDelete", { icon: "🗑️" }));
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["items", item.board_id] });
    },
    onError: (error) => {
      toast.error(t("errorDelete"));
      console.error("Error deleting item:", error);
    },
  });

  const getDomain = (urlString: string | null) => {
    if (!urlString) return "-";
    try {
      const url = new URL(urlString);
      return url.hostname.replace("www.", "");
    } catch (error) {
      return "-";
    }
  };

  // Guests confirm through the reserve dialog, which is where the required
  // email is collected; signed-in givers reserve in one tap. Either way the
  // modal stays open afterwards so they land on the "held until <date>" state.
  const handleReserve = () => {
    if (needsEmail) {
      setReserveOpen(true);
      return;
    }
    // A signed-in account with no address on file still has to give one.
    void reserve().then(({ error }) => {
      if (error === "email_required") setReserveOpen(true);
    });
  };

  const confirmReserve = (email: string, password?: string) =>
    reserve(email, password);

  const handleUnReserve = async () => {
    const ok = await unreserve();
    if (ok) closeModal();
  };

  const markAsBought = async () => {
    try {
      const { data, error } = await supabase
        .from("items")
        .update({ status: "purchased" })
        .eq("id", id)
        .select("board_id")
        .single();

      if (error) throw error;

      // The wish leaves the grid the moment it's marked received, so the toast
      // carries the undo — the dashboard archive is the slower way back. Longer
      // than the default 3s: an undo you can't reach in time isn't an undo.
      toast.success(
        (activeToast) => (
          <span className="flex items-center gap-3">
            {t("successMarkAsBought")}
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => {
                toast.dismiss(activeToast.id);
                revertPurchase.mutate(id);
              }}
            >
              {t("ctaUndo")}
            </button>
          </span>
        ),
        { duration: 8000 }
      );

      await queryClient.invalidateQueries({
        queryKey: ["items", data.board_id],
      });
      await queryClient.invalidateQueries({ queryKey: ARCHIVE_KEY });

      closeModal();
    } catch (err) {
      console.error("Error marking item as bought:", err);
      toast.error(t("errorMarkAsBought"));
    }
  };

  const handleDelete = async (id: string, title: string) => {
    const ok = await confirm({
      title: t("confirmDeleteTitle"),
      message: t("confirmDeleteMessage", { title }),
      confirmText: t("confirmDeleteButton"),
    });

    if (!ok) return;

    deleteItem.mutate(id);
  };

  const disablePublicEditing =
    inPublicBoard &&
    item.status === "reserved" &&
    item.reserved_by !== user?.id;

  return (
    <>
      {!hideTrigger && (
        <button
          className={triggerClassName}
          disabled={disablePublicEditing}
          onClick={() => setIsOpen(true)}
        >
          {t("ctaView")}
        </button>
      )}
      {isOpen && (
        <dialog open={isOpen} className="modal">
          <div className="modal-box pb-10 md:pb-4 pt-10">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={closeModal}
              about="Uždaryti modalą"
            >
              <LuX className="text-lg" />
            </button>
            {isEditing ? (
              <ItemForm
                item={item}
                onCloseModal={closeModal}
                onCancel={() => setIsEditing(false)}
              />
            ) : (
              <>
                <div className="relative">
                <div
                  ref={scrollRef}
                  onScroll={updateScrollCue}
                  className="flex flex-col max-h-[60vh] overflow-auto"
                >
                  <figure className="w-full mb-6 shrink-0 flex flex-col items-center gap-3 md:flex-row md:items-start md:gap-4">
                    <img
                      src={images[activeIndex] ?? "/assets/placeholder.jpg"}
                      alt={title}
                      className="max-w-[300px] max-h-[42vh] w-full rounded-md object-contain md:flex-1"
                      data-clarity-mask="true"
                      onLoad={updateScrollCue}
                      onError={(e) => {
                        e.currentTarget.src = "/assets/placeholder.jpg";
                      }}
                    />
                    {images.length > 1 && (
                      <div className="flex flex-row gap-2 justify-center md:flex-col">
                        {images.map((url, i) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setActiveIndex(i)}
                            className={`w-12 h-12 rounded overflow-hidden border-2 transition-colors ${
                              i === activeIndex
                                ? "border-primary"
                                : "border-transparent opacity-60 hover:opacity-100"
                            }`}
                          >
                            <img
                              src={url}
                              alt={`Image ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </figure>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg" data-clarity-mask="true">
                      {title}
                    </h3>
                    {isInfinite && (
                      <span className="badge badge-info gap-1">
                        <span aria-hidden>∞</span>
                        {t("infiniteShort")}
                      </span>
                    )}
                  </div>
                  <p className="py-4" data-clarity-mask="true">
                    {notes}
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center w-full">
                      <p className="text-start">{t("price")}</p>
                      <p className="text-end">&euro;{price ?? "-"}</p>
                    </div>
                    <div className="flex justify-between items-center w-full">
                      <p className="text-start">{t("shop")}</p>
                      {!url ? (
                        <p className="text-end">{t("notProvided")}</p>
                      ) : (
                        <a
                          href={`/out?u=${encodeURIComponent(url)}&item=${id}`}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          className="text-end flex gap-1 items-center link"
                          data-clarity-mask="true"
                        >
                          {getDomain(url)}
                          <LuExternalLink className="w-3" />
                        </a>
                      )}
                    </div>
                    {/* Shown next to the link, not only in the legal pages:
                        commercial intent has to be disclosed at the point of
                        click. /out falls back to the raw URL for merchants we
                        have no programme with, so the wording stays hedged
                        ("some links"). */}
                    {url && (
                      <p className="text-xs opacity-60 text-end">
                        {t("affiliateDisclosure")}
                      </p>
                    )}
                  </div>
                </div>
                {/* Subtle fade hinting there's more to scroll to. */}
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-base-100 to-transparent transition-opacity duration-200 ${
                    showScrollCue ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>

                {reserveOpen ? (
                  <ReserveForm
                    item={item}
                    boardName={boardName}
                    variant="inline"
                    isPending={isPending}
                    onConfirm={confirmReserve}
                    onDone={() => setReserveOpen(false)}
                  />
                ) : (
                  <>
                {inPublicBoard && isInfinite && (
                  <div className="alert mt-8 justify-start">
                    <span aria-hidden className="text-xl">
                      ∞
                    </span>
                    <span>{t("infiniteBadge")}</span>
                  </div>
                )}

                {/* The hold window, stated before the giver commits — not as a
                    consolation after the fact. */}
                {inPublicBoard &&
                  !isInfinite &&
                  item.status === "wanted" &&
                  !isPending && (
                    <p className="text-sm text-base-content/60 mt-8 -mb-4 text-center md:text-left">
                      {t("reserveHoldPreview")}
                    </p>
                  )}

                <div className="modal-action flex-col-reverse md:flex-row mt-8">
                  {inPublicBoard && !isInfinite && item.status === "wanted" && (
                    <>
                      <button
                        disabled={
                          isPending ||
                          (inPublicBoard && item.reserved_by === user?.id)
                        }
                        className="btn btn-primary"
                        data-busy={isPending || undefined}
                        onClick={handleReserve}
                      >
                        {t("ctaReserve")}
                      </button>
                    </>
                  )}

                  {inPublicBoard && !isInfinite && item.status === "reserved" && (
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                      {isMyReservation && (
                        <p className="text-sm text-success font-medium text-center md:text-left">
                          {t("reservedUntil")}
                        </p>
                      )}
                      <button
                        disabled={item.reserved_by !== user?.id}
                        className="btn btn-primary"
                        onClick={handleUnReserve}
                      >
                        {t("ctaUnreserve")}
                      </button>
                    </div>
                  )}

                  {!inPublicBoard && (
                    <div className="flex justify-between w-full">
                      <div className="flex gap-2">
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDelete(item.id, item.title)}
                          aria-label={t("ctaDelete")}
                        >
                          <LuTrash2 className="text-lg" />
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => setIsEditing(true)}
                          aria-label={t("ctaEdit")}
                        >
                          <LuPencil className="text-lg" />
                        </button>
                      </div>
                      <button
                        className="btn btn-accent"
                        onClick={() => markAsBought()}
                      >
                        {t("ctaMarkAsBought")}
                      </button>
                    </div>
                  )}
                </div>
                  </>
                )}
              </>
            )}
          </div>
          <div className="modal-backdrop" onClick={closeModal}>
            <button>uždaryti</button>
          </div>
        </dialog>
      )}
    </>
  );
}
