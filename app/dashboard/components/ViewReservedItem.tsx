"use client";

import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, useRef } from "react";
import { LuExternalLink } from "react-icons/lu";
import { User } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import { Item } from "@/app/boards/[boardId]/components/WishList";

export function ViewReservedItem({
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
  const t = useTranslations("Boards");

  const modalRef = useRef<HTMLDialogElement>(null);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const openModal = () => {
    setIsOpen(true);
    modalRef.current?.showModal();
  };
  const closeModal = () => {
    setIsOpen(false);
    modalRef.current?.close();
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
      <dialog ref={modalRef} open={isOpen} className="modal">
        <div className="modal-box">
          <>
            <figure className="w-full mb-6">
              {item.image_url ? (
                <img src={item.image_url} alt={title} />
              ) : (
                <img src="/assets/placeholder.jpg" alt="Gift illustration" />
              )}
            </figure>
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="py-4">{notes}</p>
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
                  >
                    {getDomain(url)}
                    <LuExternalLink className="w-3" />
                  </a>
                )}
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

              <form method="dialog">
                {/* if there is a button in form, it will close the modal */}
                <button className="btn  btn-secondary">{t("ctaClose")}</button>
              </form>
            </div>
          </>
        </div>
      </dialog>
    </>
  );
}
