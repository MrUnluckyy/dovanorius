"use client";
import { useState, useRef, useEffect } from "react";
import { LuShare, LuGlobe, LuLock, LuCopy, LuX } from "react-icons/lu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { Board } from "./BoardBar";

type Props = {
  board: Board;
};

export function ShareModal({ board }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const modalRef = useRef<HTMLDialogElement | null>(null);
  const t = useTranslations("Boards");
  const supabase = createClient();
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const openModal = () => {
    setIsOpen(true);
    modalRef.current?.showModal();
  };

  const closeModal = () => {
    setIsOpen(false);
    modalRef.current?.close();
  };

  // `.select().single()` is load-bearing on both mutations, not decoration: an
  // UPDATE whose row is filtered out by RLS comes back as success with zero
  // rows and a null error. Without it, generate hands out a link whose token
  // was never stored (404 from birth) and revoke reports success while the
  // board stays reachable — the owner believing they cut access when they
  // haven't. `.single()` turns zero rows into a thrown PGRST116 instead.
  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID();
      const { data, error } = await supabase
        .from("boards")
        .update({ share_token: token })
        .eq("id", board.id)
        .select("share_token")
        .single();
      if (error) throw error;
      // Return what the database holds, not what we hoped it would hold.
      return data.share_token as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", board.id] }),
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("boards")
        .update({ share_token: null })
        .eq("id", board.id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", board.id] }),
    onError: (err) => {
      toast.error(t("revokeMagicLinkError"));
      console.error("Failed to revoke share token:", err);
    },
  });

  const copyLink = async (build: () => Promise<string> | string) => {
    try {
      await navigator.clipboard.writeText(await build());
      toast.success(t("copied"));
    } catch (err) {
      toast.error(t("copyFailed"));
      console.error("Failed to copy:", err);
    }
  };

  const copyPublic = async () => {
    if (!board.slug) return;
    await copyLink(() => `${origin}/b/${board.slug}`);
  };

  const copyPrivate = async () =>
    copyLink(async () => {
      const token =
        board.share_token ?? (await generateTokenMutation.mutateAsync());
      return `${origin}/b/s/${token}`;
    });

  const handleRevoke = async () => {
    // Without confirmText the shared dialog labels its confirm button "Ištrinti"
    // (Delete), and its cancel button "Atšaukti" — which is also the verb this
    // feature used to use for revoking, so cancel read like the action itself.
    const ok = await confirm({
      title: t("revokeMagicLinkTitle"),
      message: t("revokeMagicLinkDesc"),
      confirmText: t("revokeMagicLinkConfirm"),
    });
    // mutateAsync rejects on failure; onError already toasts, so swallow the
    // rejection rather than leaving it unhandled in a click handler.
    if (ok) await revokeTokenMutation.mutateAsync().catch(() => {});
  };

  return (
    <>
      <button className="btn btn-outline whitespace-nowrap w-full md:w-auto" onClick={openModal}>
        <LuShare />
        {t("share")}
      </button>

      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-md p-6">
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
            onClick={closeModal}
          >
            <LuX />
          </button>

          <h3 className="font-bold text-lg">{t("shareModalTitle")}</h3>
          <p className="text-sm text-base-content/50 mt-0.5 mb-6">{board.name}</p>

          <div className="flex flex-col gap-3">
            {board.is_public && board.slug && (
              <div className="rounded-xl border border-base-300 p-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <LuGlobe size={15} className="text-base-content/60" />
                  <span className="text-sm font-semibold">{t("sharePublicTitle")}</span>
                </div>
                <p className="text-xs text-base-content/40 mb-3">{t("sharePublicDesc")}</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    className="input input-sm flex-1 text-xs bg-base-200 border-0 font-mono"
                    value={`${origin}/b/${board.slug}`}
                  />
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={copyPublic}
                    aria-label={t("copyInviteLink")}
                  >
                    <LuCopy size={15} />
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-base-300 p-4">
              <div className="flex items-center gap-2 mb-0.5">
                <LuLock size={15} className="text-base-content/60" />
                <span className="text-sm font-semibold">{t("sharePrivateTitle")}</span>
              </div>
              <p className="text-xs text-base-content/40 mb-3">{t("sharePrivateDesc")}</p>

              {board.share_token ? (
                <>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      className="input input-sm flex-1 text-xs bg-base-200 border-0 font-mono"
                      value={`${origin}/b/s/${board.share_token}`}
                    />
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={copyPrivate}
                      disabled={generateTokenMutation.isPending}
                      aria-label={t("copyInviteLink")}
                    >
                      <LuCopy size={15} />
                    </button>
                  </div>
                  <button
                    className="btn btn-xs btn-ghost text-error mt-3 px-0 h-auto min-h-0"
                    onClick={handleRevoke}
                    disabled={revokeTokenMutation.isPending}
                  >
                    {t("revokeMagicLink")}
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-sm btn-outline w-full"
                  onClick={copyPrivate}
                  disabled={generateTokenMutation.isPending}
                >
                  <LuLock size={14} />
                  {generateTokenMutation.isPending ? "…" : t("generatePrivateLink")}
                </button>
              )}
            </div>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={closeModal}>close</button>
        </form>
      </dialog>
    </>
  );
}
