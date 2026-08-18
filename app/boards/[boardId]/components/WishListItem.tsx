"use client";
import React, { useState } from "react";
import { Item } from "./WishList";
import { User } from "@supabase/supabase-js";
import { ViewItemModal } from "./ViewItemModal";
import PriceCategoryBadge from "./PriceCategoryBadge";
import { useTranslations } from "next-intl";
import { useReserveItem } from "@/hooks/useReserveItem";
import { ReserveDialog } from "./ReserveDialog";
import { FillImage } from "@/components/ui/FillImage";

const PLACEHOLDER = "/assets/placeholder.jpg";

type Props = {
  item: Item;
  boardId: string;
  inPublicBoard?: boolean;
  user?: User | null;
  boardName?: string | null;
  shareToken?: string | null;
  getCaptchaToken?: () => Promise<string | undefined>;
  resetCaptcha?: () => void;
};

export function WishListItem({
  item,
  inPublicBoard,
  user,
  boardName,
  shareToken,
  getCaptchaToken,
  resetCaptcha,
}: Props) {
  const { title, price, status, reserved_by } = item;
  const t = useTranslations("Boards");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const imgSrc = item?.image_urls?.[0] ?? item?.image_url ?? PLACEHOLDER;

  const isMine = reserved_by === user?.id;
  // Infinite ("unlimited") wish: can be given many times, never reserved.
  const isInfinite = item.is_reservable === false;
  // Reserved by someone else → hide the gift: blur image + strip metadata.
  const isBlocked =
    !!inPublicBoard && status === "reserved" && !!reserved_by && !isMine;

  const { reserve, unreserve, isPending, needsEmail } = useReserveItem({
    itemId: item.id,
    boardId: item.board_id,
    user,
    getCaptchaToken,
    resetCaptcha,
    shareToken,
  });

  // Reserving from the card is one tap for signed-in givers, whose address we
  // already hold. Guests get the same dialog the detail view uses — the button
  // being on a card is no reason to take a hold we can never remind them about.
  const startReserve = () => {
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

  // One-click reserve/unreserve straight from the card (no modal), for
  // reservable wishes on a public board. Reserving as a guest silently creates
  // an anonymous session via the shared captcha.
  const canReserve = !!inPublicBoard && !isInfinite && status === "wanted";
  const canUnreserve =
    !!inPublicBoard && !isInfinite && status === "reserved" && isMine;
  // Infinite wishes still show a Reserve button, but disabled + explained, so
  // every public card keeps the same clean layout.
  const showDisabledInfinite = !!inPublicBoard && isInfinite && !isBlocked;
  // Whether a primary (reserve) button is present. When it is, the details
  // button drops to a quiet ghost style; otherwise it's the card's main action.
  const hasPrimaryAction = canReserve || canUnreserve || showDisabledInfinite;

  // The whole card (image + title) opens the details modal — people expect to
  // click the card, not hunt for a button. Blocked (others' reserved) cards
  // stay inert.
  const cardClickable = !isBlocked;
  const openDetails = () => setDetailsOpen(true);

  const displayTitle = isBlocked ? t("reservedWish") : title;

  return (
    <div
      className={`card bg-base-200 shadow-sm h-full transition-shadow ${
        isBlocked ? "opacity-70" : "hover:shadow-md"
      }`}
    >
      <div
        className={`flex flex-1 flex-col rounded-t-2xl ${
          cardClickable
            ? "cursor-pointer transition-colors hover:bg-base-300/40"
            : ""
        }`}
        role={cardClickable ? "button" : undefined}
        tabIndex={cardClickable ? 0 : undefined}
        aria-label={cardClickable ? `${t("ctaView")}: ${title}` : undefined}
        onClick={cardClickable ? openDetails : undefined}
        onKeyDown={
          cardClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDetails();
                }
              }
            : undefined
        }
      >
        <figure className="px-10 pt-10">
          <div
            className="aspect-square w-32 overflow-hidden rounded-md relative"
            aria-hidden={!item?.image_url && !item?.image_urls?.length}
          >
            <FillImage
              src={imgSrc}
              alt={isBlocked ? t("reservedWish") : title ?? "Gift image"}
              sizes="(max-width: 768px) 45vw, (max-width: 1024px) 30vw, 160px"
              className={`object-cover object-center transition ${
                isBlocked ? "blur-xl scale-125" : ""
              }`}
            />
            {isBlocked && (
              <div className="absolute inset-0 bg-base-100/30" aria-hidden />
            )}
            {!isBlocked && (item?.image_urls?.length ?? 0) > 1 && (
              <span className="absolute bottom-1 right-1 badge badge-xs badge-neutral opacity-90">
                +{item.image_urls.length - 1}
              </span>
            )}
          </div>

          {isInfinite ? (
            <div className="badge badge-sm badge-info absolute top-2 left-2 gap-1">
              <span aria-hidden>∞</span>
              {t("infiniteShort")}
            </div>
          ) : inPublicBoard && status === "reserved" && reserved_by ? (
            <div
              className="badge badge-sm badge-warning absolute top-2 left-2"
              data-clarity-mask="true"
            >
              {isMine ? t("myReservation") : t("reserved")}
            </div>
          ) : (
            <PriceCategoryBadge price={price} />
          )}
        </figure>
        <div className="card-body items-center text-center p-4 pb-2 flex-1 justify-center">
          <h2
            className="card-title text-md text-sm line-clamp-2"
            data-clarity-mask="true"
          >
            {displayTitle}
          </h2>
        </div>
      </div>

      {!isBlocked && (
        <div className="card-actions flex-col w-full gap-2 p-4 pt-0">
          {canReserve && (
            <button
              className="btn btn-sm btn-primary w-full"
              disabled={isPending}
              onClick={startReserve}
            >
              {isPending && <span className="loading loading-spinner loading-xs" />}
              {t("ctaReserve")}
            </button>
          )}
          {canUnreserve && (
            <button
              className="btn btn-sm btn-outline btn-primary w-full"
              disabled={isPending}
              onClick={() => unreserve()}
            >
              {isPending && <span className="loading loading-spinner loading-xs" />}
              {t("ctaUnreserve")}
            </button>
          )}
          {showDisabledInfinite && (
            <div
              className="tooltip tooltip-top w-full before:max-w-[12rem] before:whitespace-normal"
              data-tip={t("infiniteHint")}
            >
              <button className="btn btn-sm btn-primary w-full" disabled>
                {t("ctaReserve")}
              </button>
            </div>
          )}
          {/* Explicit "open details" affordance — makes it clear (especially on
              mobile, and on cards that also have a Reserve button) that there's
              a full wish view behind the card, not just the reserve action. */}
          <button
            type="button"
            className={`btn btn-sm w-full ${
              hasPrimaryAction ? "btn-ghost" : "btn-primary"
            }`}
            onClick={openDetails}
          >
            {t("ctaView")}
          </button>
        </div>
      )}

      <ViewItemModal
        item={item}
        inPublicBoard={inPublicBoard}
        user={user}
        boardName={boardName}
        shareToken={shareToken}
        getCaptchaToken={getCaptchaToken}
        resetCaptcha={resetCaptcha}
        hideTrigger
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <ReserveDialog
        item={item}
        boardName={boardName}
        open={reserveOpen}
        isPending={isPending}
        onClose={() => setReserveOpen(false)}
        onConfirm={confirmReserve}
      />
    </div>
  );
}
