"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Profile } from "@/types/secret-santa";
import { createClient } from "@/utils/supabase/client";
import { sendInvites } from "../invites/action";

type FollowRow = { followee: Profile };

interface Props {
  slug: string;
  open: boolean;
  onClose: () => void;
}

export default function InviteFollowersModal({ slug, open, onClose }: Props) {
  const sb = createClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) setSelected(new Set());
  }, [open]);

  // People I follow (followees)
  type FollowRow = { followee: Profile };
  const { data: followees, isLoading } = useQuery<Profile[]>({
    enabled: open,
    queryKey: ["ss:followees"],
    queryFn: async () => {
      const { data: auth } = await sb.auth.getUser();
      const me = auth.user?.id;
      if (!me) return [];

      const { data, error } = await sb
        .from("follows")
        .select(
          `followee:profiles!follows_followee_id_fkey (
      id,
      display_name,
      avatar_url
    )`
        )
        .eq("follower_id", me)
        .returns<FollowRow[]>();
      if (error) throw error;
      return (data ?? []).map((r) => r.followee);
    },
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!selected.size) return onClose();
    const toUserIds = Array.from(selected);
    const res = await sendInvites(slug, toUserIds);
    if (res.ok) onClose();
  };

  if (!open) return null;

  return (
    <dialog open className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-3">Invite followers</h3>
        <div className="max-h-80 overflow-auto">
          {isLoading && <div className="skeleton h-10 w-full" />}
          <ul className="menu bg-base-200 rounded-box">
            {(followees ?? []).map((p) => (
              <li key={p.id}>
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <div className="avatar">
                    <div className="w-8 rounded-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.avatar_url ?? "/avatar.png"} alt="" />
                    </div>
                  </div>
                  <span>{p.display_name ?? p.id.slice(0, 6)}</span>
                </label>
              </li>
            ))}
            {(followees ?? []).length === 0 && !isLoading && (
              <div className="p-3 opacity-70">
                You’re not following anyone yet.
              </div>
            )}
          </ul>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={selected.size === 0}
          >
            Send {selected.size ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onClose}>
        <button>close</button>
      </form>
    </dialog>
  );
}
