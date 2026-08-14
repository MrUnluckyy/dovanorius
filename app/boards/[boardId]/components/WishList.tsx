"use client";
import { useQuery } from "@tanstack/react-query";
import { AddItemModal } from "./AddItemModal";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { WishListItem } from "./WishListItem";
import { LuPlus } from "react-icons/lu";
import { useCallback, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export type Item = {
  id: string;
  board_id: string;
  title: string;
  notes: string | null;
  url: string | null;
  price: number | null;
  image_url: string | null;
  image_urls: string[];
  is_reservable: boolean;
  status: "wanted" | "reserved" | "purchased";
  reserved_by: string | null;
  reserve_expires_at: string | null;
  priority: "low" | "medium" | "high";
  created_at: string;
};

export function WishList({
  boardId,
  isPublic,
  user,
}: {
  boardId: string;
  isPublic?: boolean;
  user?: User | null;
}) {
  const supabase = createClient();
  const t = useTranslations("Boards");

  // One shared invisible captcha for the whole list: guests reserve one item at
  // a time, so a single Turnstile instance backs every card's quick-reserve
  // button (and the detail modal) instead of one iframe per card.
  const turnstileRef = useRef<TurnstileInstance>(null);
  const needsCaptcha =
    !!isPublic && !user && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const getCaptchaToken = useCallback(
    async () => turnstileRef.current?.getResponsePromise(),
    []
  );
  const resetCaptcha = useCallback(() => turnstileRef.current?.reset(), []);

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["items", boardId],
    queryFn: async () => {
      // Reservation visibility is enforced server-side: recipient-side viewers
      // (board owner + collaborators) never receive others' reserved_by/status.
      const { data, error } = await supabase.rpc("get_board_items", {
        p_board_id: boardId,
      });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  return (
    <div className="">
      {isLoading ? (
        <BoardsLoadingSkeleton />
      ) : error ? (
        <p className="text-error">😵 failed to load items 😵</p>
      ) : (
        <>
          {!isPublic && (
            <div className="mb-4">
              <AddItemModal boardId={boardId}>
                <LuPlus />
                {t("addWish")}
              </AddItemModal>
            </div>
          )}
          {items.length === 0 ? (
            <div className="flex flex-col justify-center items-center">
              <p className="text-center">{t("noItems")}</p>
            </div>
          ) : null}

          {needsCaptcha && (
            <Turnstile
              ref={turnstileRef}
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
              options={{ size: "invisible" }}
            />
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {items.map((item) => (
              <WishListItem
                key={item.id}
                boardId={boardId}
                item={item}
                inPublicBoard={isPublic}
                user={user}
                getCaptchaToken={getCaptchaToken}
                resetCaptcha={resetCaptcha}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
