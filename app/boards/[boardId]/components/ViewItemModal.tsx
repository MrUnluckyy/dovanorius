"use client";

import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, useRef } from "react";
import {
  LuCheck,
  LuExternalLink,
  LuPencil,
  LuTrash,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { Item } from "./WishList";
import { User } from "@supabase/supabase-js";
import { ItemForm } from "./ItemForm";
import toast from "react-hot-toast";

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
  const [showConfirmView, setShowConfirmView] = useState(false);
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
    setIsEditing(false);
  };

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("successDelete"));
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
    if (!user) {
      toast.error("Rezervuoti galima tik prisijungus.");
      return;
    }
    const { data, error } = await supabase.rpc("reserve_item", {
      p_item_id: id,
    });

    if (data) {
      toast.success(t("successReserve"));
      queryClient.invalidateQueries({ queryKey: ["items", item.board_id] });
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
      queryClient.invalidateQueries({ queryKey: ["items", item.board_id] });
      closeModal();
    }
    if (error) {
      toast.error(t("errorUnreserve"));
      console.error("Error unreserving item:", error);
    }
  };

  const markAsBought = async () => {
    const { data, error } = await supabase
      .from("items")
      .update({
        status: "purchased",
      })
      .eq("id", id)
      .single();

    if (data) {
      toast.success(t("successMarkAsBought"));
      queryClient.invalidateQueries({ queryKey: ["items", item.board_id] });
      closeModal();
    }
    if (error) {
      toast.error(t("errorMarkAsBought"));
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
        <div className="modal-box pb-16 md:pb-4 pt-10">
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
              <figure className="w-full mb-6">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={title}
                    className="max-w-[300px]"
                  />
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
              {!user && inPublicBoard && (
                <p className="text-error font-bold">
                  Rezervuoti galima tik prisijungus
                </p>
              )}

              <div className="modal-action flex-col-reverse md:flex-row mt-8">
                {inPublicBoard && item.status === "wanted" && (
                  <>
                    <button
                      disabled={
                        (inPublicBoard && item.reserved_by === user?.id) ||
                        !user
                      }
                      className="btn btn-primary"
                      onClick={handleReserve}
                    >
                      {t("ctaReserve")}
                    </button>
                  </>
                )}

                {inPublicBoard && item.status === "reserved" && (
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

                {!inPublicBoard && (
                  <div className="flex justify-between w-full">
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost"
                        onClick={() => deleteItem.mutate(item.id)}
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
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>uždaryti</button>
        </form>
      </dialog>
    </>
  );
}
