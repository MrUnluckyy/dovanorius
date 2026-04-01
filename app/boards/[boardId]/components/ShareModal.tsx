"use client";
import { useState, useRef, useEffect } from "react";
import { LuShare, LuGlobe, LuLock, LuCopy, LuCheck, LuX } from "react-icons/lu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { Board } from "./BoardBar";

type Props = {
  board: Board;
};

export function ShareModal({ board }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [publicCopied, setPublicCopied] = useState(false);
  const [privateCopied, setPrivateCopied] = useState(false);
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

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from("boards")
        .update({ share_token: token })
        .eq("id", board.id);
      if (error) throw error;
      return token;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", board.id] }),
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("boards")
        .update({ share_token: null })
        .eq("id", board.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["board", board.id] }),
  });

  const copyPublic = async () => {
    if (!board.slug) return;
    await navigator.clipboard.writeText(`${origin}/b/${board.slug}`);
    setPublicCopied(true);
    setTimeout(() => setPublicCopied(false), 2000);
  };

  const copyPrivate = async () => {
    let token = board.share_token;
    if (!token) {
      token = await generateTokenMutation.mutateAsync();
    }
    await navigator.clipboard.writeText(`${origin}/b/s/${token}`);
    setPrivateCopied(true);
    setTimeout(() => setPrivateCopied(false), 2000);
  };

  const handleRevoke = async () => {
    const ok = await confirm({
      title: t("revokeMagicLinkTitle"),
      message: t("revokeMagicLinkDesc"),
    });
    if (ok) await revokeTokenMutation.mutateAsync();
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
                    className={`btn btn-sm transition-all ${publicCopied ? "btn-success" : "btn-primary"}`}
                    onClick={copyPublic}
                  >
                    {publicCopied ? <LuCheck size={15} /> : <LuCopy size={15} />}
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
                      className={`btn btn-sm transition-all ${privateCopied ? "btn-success" : "btn-primary"}`}
                      onClick={copyPrivate}
                      disabled={generateTokenMutation.isPending}
                    >
                      {privateCopied ? <LuCheck size={15} /> : <LuCopy size={15} />}
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
