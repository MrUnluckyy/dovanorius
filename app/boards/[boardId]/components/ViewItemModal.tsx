"use client";

import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { format } from "date-fns";
import { enUS, lt } from "date-fns/locale";
import { LuExternalLink, LuPencil, LuTrash2, LuX } from "react-icons/lu";
import { Item } from "./WishList";
import { User } from "@supabase/supabase-js";
import { ItemForm } from "./ItemForm";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmDialogProvider";

export function ViewItemModal({
  item,
  inPublicBoard,
  user,
}: {
  item: Item;
  inPublicBoard?: boolean;
  user?: User | null;
}) {
  const { title, notes, price, url, id } = item;
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reminderStep, setReminderStep] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);

  const images =
    item.image_urls?.length
      ? item.image_urls
      : item.image_url
      ? [item.image_url]
      : [];
  const t = useTranslations("Boards");
  const locale = useLocale();
  const confirm = useConfirm();

  const supabase = createClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance>(null);

  const isMyReservation =
    item.status === "reserved" && item.reserved_by === user?.id;

  // Infinite ("unlimited") wish: can be given many times, never reserved.
  const isInfinite = item.is_reservable === false;

  const expiryLabel = item.reserve_expires_at
    ? format(new Date(item.reserve_expires_at), "PPP", {
        locale: locale === "lt" ? lt : enUS,
      })
    : null;

  const openModal = () => {
    setIsOpen(true);
    setActiveIndex(0);
    // Renew-on-activity: re-opening your own hold pushes the expiry out.
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
  };
  const closeModal = () => {
    setIsOpen(false);
    setIsEditing(false);
    setReminderStep(false);
    setReminderEmail("");
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

  const handleReserve = async () => {
    // Guests can reserve without an account: create a silent anonymous
    // session on first reserve, then proceed with the same reserve flow.
    if (!user) {
      // Solve the (invisible) captcha before creating the guest session so
      // bots can't spam anonymous sign-ins.
      let captchaToken: string | undefined;
      try {
        captchaToken = await turnstileRef.current?.getResponsePromise();
      } catch (captchaError) {
        toast.error(t("errorReserve"));
        console.error("Captcha verification failed:", captchaError);
        return;
      }

      const { error: authError } = await supabase.auth.signInAnonymously({
        options: { captchaToken },
      });
      if (authError) {
        toast.error(t("errorReserve"));
        console.error("Error creating guest session:", authError);
        turnstileRef.current?.reset();
        return;
      }
    }

    const { data, error } = await supabase.rpc("reserve_item", {
      p_item_id: id,
    });

    if (data) {
      toast.success(t("successReserve"));
      queryClient.invalidateQueries({ queryKey: ["items", item.board_id] });
      // Refresh so the server re-renders with the new (anonymous) session,
      // keeping the "my reservation" badge and unreserve action in sync.
      router.refresh();
      // Offer an optional reminder email instead of closing right away.
      setReminderStep(true);
    }

    if (error) {
      toast.error(t("errorReserve"));
      console.error("Error reserving item:", error);
    }
  };

  const saveReminder = async () => {
    setSavingReminder(true);
    const { error } = await supabase.rpc("set_reservation_reminder", {
      p_item_id: id,
      p_email: reminderEmail,
    });
    setSavingReminder(false);
    if (error) {
      toast.error(t("reminderError"));
      console.error(
        "Error saving reminder:",
        error.message,
        "| code:",
        error.code,
        "| details:",
        error.details,
        "| hint:",
        error.hint
      );
      return;
    }
    toast.success(t("reminderSaved"));
    closeModal();
  };

  const handleUnReserve = async () => {
    const { data, error } = await supabase.rpc("unreserve_item", {
      p_item_id: id,
    });
    if (data) {
      toast.success(t("successUnreserve"));
      queryClient.invalidateQueries({ queryKey: ["items", item.board_id] });
      closeModal();
    }
    if (error) {
      toast.error(t("errorUnreserve"));
      console.error("Error unreserving item:", error);
    }
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

      toast.success(t("successMarkAsBought"));

      await queryClient.invalidateQueries({
        queryKey: ["items", data.board_id],
      });

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
      <button
        className="btn btn-sm btn-primary"
        disabled={disablePublicEditing}
        onClick={openModal}
      >
        {t("ctaView")}
      </button>
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
                <div className="flex flex-col max-h-[60vh] overflow-auto">
                  <figure className="w-full mb-6 shrink-0 flex flex-col items-center gap-3 md:flex-row md:items-start md:gap-4">
                    <img
                      src={images[activeIndex] ?? "/assets/placeholder.jpg"}
                      alt={title}
                      className="max-w-[300px] w-full rounded-md object-contain md:flex-1"
                      data-clarity-mask="true"
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
                          href={url || ""}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-end flex gap-1 items-center link"
                          data-clarity-mask="true"
                        >
                          {getDomain(url)}
                          <LuExternalLink className="w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {reminderStep ? (
                  <div className="mt-8 border-t border-base-300 pt-6">
                    <p className="font-semibold">{t("reminderPrompt")}</p>
                    <p className="text-sm opacity-70">{t("reminderHint")}</p>
                    <p className="text-sm font-medium text-success mb-3">
                      {expiryLabel
                        ? t("reservedUntil", { date: expiryLabel })
                        : t("reminderValidity")}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        className="input input-bordered flex-1"
                        placeholder={t("reminderPlaceholder")}
                        value={reminderEmail}
                        onChange={(e) => setReminderEmail(e.target.value)}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={saveReminder}
                        disabled={savingReminder || !reminderEmail}
                      >
                        {savingReminder ? t("ctaSaving") : t("reminderSave")}
                      </button>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm mt-2"
                      onClick={closeModal}
                    >
                      {t("reminderSkip")}
                    </button>
                  </div>
                ) : (
                  <>
                    {!user &&
                      inPublicBoard &&
                      !isInfinite &&
                      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                        <Turnstile
                          ref={turnstileRef}
                          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                          options={{ size: "invisible" }}
                        />
                      )}

                    {inPublicBoard && isInfinite && (
                      <div className="alert mt-8 justify-start">
                        <span aria-hidden className="text-xl">
                          ∞
                        </span>
                        <span>{t("infiniteBadge")}</span>
                      </div>
                    )}

                    <div className="modal-action flex-col-reverse md:flex-row mt-8">
                  {inPublicBoard && !isInfinite && item.status === "wanted" && (
                    <>
                      <button
                        disabled={inPublicBoard && item.reserved_by === user?.id}
                        className="btn btn-primary"
                        onClick={handleReserve}
                      >
                        {t("ctaReserve")}
                      </button>
                    </>
                  )}

                  {inPublicBoard && !isInfinite && item.status === "reserved" && (
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                      {isMyReservation && expiryLabel && (
                        <p className="text-sm text-success font-medium text-center md:text-left">
                          {t("reservedUntil", { date: expiryLabel })}
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
