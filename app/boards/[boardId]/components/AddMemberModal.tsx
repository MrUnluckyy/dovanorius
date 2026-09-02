"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { LuUserPlus, LuX, LuCopy, LuTrash2 } from "react-icons/lu";
import { useFollow } from "@/hooks/useFollow";
import { createClient } from "@/utils/supabase/client";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createBoardInvite } from "@/app/actions/boards/invite";

// --- Domain types ---
type Role = "editor" | "viewer";

interface FollowUser {
  id: string;
  avatar_url: string | null;
  display_name: string | null;
}

interface BoardInvite {
  id: string;
  email: string | null;
  token: string;
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

  const { following } = useFollow(userId) as UseFollowResult;

  const [selected, setSelected] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("editor");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const supabase = createClient();

  const { data: invites = [] } = useQuery({
    queryKey: ["boardInvites", boardId],
    enabled: isOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("board_invites")
        .select("id, email, token")
        .eq("board_id", boardId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BoardInvite[];
    },
  });

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

  async function onInvite(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const result = await createBoardInvite(boardId, inviteEmail);
    setInviting(false);

    if (!result.ok) {
      toast.error(t("inviteError"));
      return;
    }
    toast.success(result.emailSent ? t("inviteSent") : t("inviteCreated"));
    setInviteEmail("");
    queryClient.invalidateQueries({ queryKey: ["boardInvites", boardId] });
  }

  async function revokeInvite(id: string): Promise<void> {
    const { error } = await supabase
      .from("board_invites")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(t("inviteError"));
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["boardInvites", boardId] });
  }

  function copyInviteLink(token: string): void {
    navigator.clipboard.writeText(
      `${window.location.origin}/boards/join/${token}`
    );
    toast.success(t("inviteLinkCopied"));
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

            <button className="btn btn-primary" onClick={onAdd}>
              {t("ctaAdd")}
            </button>
          </div>

          <div className="divider text-xs text-base-content/50">
            {t("inviteByEmail")}
          </div>

          {/* Invite a guest by email (no account required to join) */}
          <form onSubmit={onInvite} className="flex gap-2">
            <input
              type="email"
              className="input input-bordered flex-1"
              placeholder={t("inviteEmailPlaceholder")}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={inviting}
              data-busy={inviting || undefined}
            >
              {t("ctaInvite")}
            </button>
          </form>

          {invites.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-base-content/50">
                {t("pendingInvites")}
              </p>
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-base-content/70">
                    {inv.email}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs gap-1"
                    onClick={() => copyInviteLink(inv.token)}
                  >
                    <LuCopy size={12} />
                    {t("copyInviteLink")}
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => revokeInvite(inv.id)}
                    aria-label={t("revokeInvite")}
                  >
                    <LuTrash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>uždaryti</button>
        </form>
      </dialog>
    </div>
  );
}
