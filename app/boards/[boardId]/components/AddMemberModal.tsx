"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { LuUserPlus, LuX } from "react-icons/lu";
import { useFollow } from "@/hooks/useFollow";
import { createClient } from "@/utils/supabase/client";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

// --- Domain types ---
type Role = "editor" | "viewer";

interface FollowUser {
  id: string;
  avatar_url: string | null;
  display_name: string | null;
}

// If your hook is already typed, remove this interface and rely on the hook's return type.
interface UseFollowResult {
  following: FollowUser[];
  isLoading: boolean;
}

export function AddMemberModal({
  userId,
  boardId,
}: {
  userId: string;
  boardId: string;
}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const modalRef = useRef<HTMLDialogElement | null>(null);
  const t = useTranslations("Boards");
  const queryClient = useQueryClient();

  const openModal = (): void => {
    setIsOpen(true);
    modalRef.current?.showModal();
  };

  const closeModal = (): void => {
    setIsOpen(false);
    modalRef.current?.close();
  };

  const { following, isLoading } = useFollow(userId) as UseFollowResult;

  const [selected, setSelected] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("editor");

  const supabase = createClient();

  async function onAdd(): Promise<void> {
    if (!selected) return;

    const { data, error } = await supabase.rpc("add_member_by_user", {
      p_board_id: boardId,
      p_user_id: selected,
      p_role: role,
    });

    if (data) {
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["boards"] });
    }

    if (error) {
      toast.error(t("errorAddMember"));
      return;
    }
  }

  return (
    <div className="w-full">
      <button
        className="btn btn-outline w-full whitespace-nowrap"
        onClick={openModal}
      >
        <LuUserPlus />
        {t("addMember")}
      </button>

      <dialog ref={modalRef} open={isOpen} className="modal">
        <div className="modal-box">
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={closeModal}
            about="Uždaryti modalą"
          >
            <LuX className="text-lg" />
          </button>
          <h3 className="font-bold text-lg mb-3">{t("addMember")}</h3>

          <div className="flex gap-2 items-center">
            <select
              className="select"
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value || null)}
            >
              <option value="">Pasirinkti vartotoją…</option>
              {following.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name ?? u.id}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="editor">Redagavimo teisės</option>
              <option value="viewer">Peržiūros teisės</option>
            </select>
          </div>

          <div className="modal-action">
            <button className="btn btn-primary" onClick={onAdd}>
              {t("ctaAdd")}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>uždaryti</button>
        </form>
      </dialog>
    </div>
  );
}
