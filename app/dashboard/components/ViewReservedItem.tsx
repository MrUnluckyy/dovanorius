"use client";

import { createClient } from "@/utils/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuExternalLink, LuX } from "react-icons/lu";
import { User } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import { ReservedWishlistItem } from "./ReservedItems";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";

export function ViewReservedItem({
  item,
  inPublicBoard,
  user,
}: {
  item: ReservedWishlistItem;
  inPublicBoard?: boolean;
  user?: User | null;
}) {
  const { title, notes, price, url, id } = item;
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Boards");

  const supabase = createClient();
  const queryClient = useQueryClient();

  const openModal = () => {
    setIsOpen(true);
  };
  const closeModal = () => {
    setIsOpen(false);
  };

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
    const { data, error } = await supabase.rpc("unreserve_item", {
      p_item_id: id,
    });

    if (data) {
      toast.success(t("successReserve"));
      queryClient.invalidateQueries({
        queryKey: ["reservedItems"],
      });
      closeModal();
    }

    if (error) {
      toast.success(t("errorReserve"));
      console.error("Error reserving item:", error);
    }
  };

  const handleUnReserve = async () => {
    const { data, error } = await supabase.rpc("unreserve_item", {
      p_item_id: id,
    });
    if (data) {
      toast.success(t("successUnreserve"));
      queryClient.invalidateQueries({
        queryKey: ["reservedItems"],
      });
      closeModal();
    }
    if (error) {
      toast.error(t("errorUnreserve"));
      console.error("Error unreserving item:", error);
    }
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
          <div className="modal-box pt-10">
            <button
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={closeModal}
              about="Uždaryti modalą"
            >
              <LuX className="text-lg" />
            </button>
            <>
              <div className="flex flex-col max-h-[60vh] overflow-auto">
                <figure className="w-full mb-6 shrink-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={title}
                      className="max-w-[300px]"
                      data-clarity-mask="true"
                    />
                  ) : (
                    <img
                      src="/assets/placeholder.jpg"
                      alt="Gift illustration"
                    />
                  )}
                </figure>
                <h3 className="font-bold text-lg" data-clarity-mask="true">
                  {title}
                </h3>
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
                  <div className="flex justify-between items-center w-full">
                    <p className="text-start">{t("wishOwner")}</p>
                    <Link
                      href={`/users/${item.created_by.id}`}
                      className="flex gap-1 items-center link"
                      data-clarity-mask="true"
                    >
                      <Avatar
                        avatar_url={item.created_by.avatar_url}
                        name={item.created_by.display_name}
                        size={4}
                      />
                      <p>{item.created_by.display_name}</p>
                    </Link>
                  </div>
                </div>
              </div>
              <div className="modal-action">
                {item.status === "wanted" && (
                  <button
                    disabled={inPublicBoard && item.reserved_by === user?.id}
                    className="btn btn-primary"
                    onClick={handleReserve}
                  >
                    {t("ctaReserve")}
                  </button>
                )}

                {item.status === "reserved" && (
                  <button
                    disabled={
                      inPublicBoard &&
                      item.status === "reserved" &&
                      item.reserved_by !== user?.id
                    }
                    className="btn btn-primary"
                    onClick={handleUnReserve}
                  >
                    {t("ctaUnreserve")}
                  </button>
                )}
              </div>
            </>
          </div>
          <div className="modal-backdrop" onClick={closeModal}>
            <button>uždaryti</button>
          </div>
        </dialog>
      )}
    </>
  );
}
