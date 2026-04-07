"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { PartnerInvite } from "@/types/partner";
import { LuTrash2, LuCopy } from "react-icons/lu";
import toast from "react-hot-toast";

type Member = {
  id: string;
  role: string;
  created_at: string;
  user: { id: string; email: string };
};

export function TeamClient({
  members: initial,
  invites: initialInvites,
  partnerId,
  currentUserId,
  currentRole,
}: {
  members: Member[];
  invites: PartnerInvite[];
  partnerId: string;
  currentUserId: string;
  currentRole: string;
}) {
  const [members, setMembers] = useState(initial);
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const supabase = createClient();
  const isOwner = currentRole === "owner";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from("partner_invites")
      .insert({ partner_id: partnerId, email: email.trim() })
      .select()
      .single();
    setSending(false);
    if (error) { toast.error("Nepavyko sukurti kvietimo."); return; }
    setInvites((i) => [data as PartnerInvite, ...i]);
    setEmail("");
    toast.success("Kvietimas sukurtas.");
  }

  async function revokeInvite(id: string) {
    const { error } = await supabase
      .from("partner_invites")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Nepavyko panaikinti."); return; }
    setInvites((i) => i.filter((x) => x.id !== id));
  }

  async function removeMember(id: string) {
    if (!confirm("Pašalinti narį?")) return;
    const { error } = await supabase
      .from("partner_users")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Nepavyko pašalinti."); return; }
    setMembers((m) => m.filter((x) => x.id !== id));
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${origin}/partner/join/${token}`);
    toast.success("Nuoroda nukopijuota.");
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold font-heading">Komanda</h1>

      {/* Current members */}
      <div className="card card-border bg-base-100">
        <div className="card-body gap-3">
          <h2 className="font-semibold text-sm">Nariai ({members.length})</h2>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="avatar placeholder">
                <div className="bg-neutral text-neutral-content rounded-full w-8">
                  <span className="text-xs">
                    {m.user?.email?.[0]?.toUpperCase() ?? "?"}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{m.user?.email}</p>
                <span className="badge badge-ghost badge-xs capitalize">{m.role}</span>
              </div>
              {isOwner && m.user?.id !== currentUserId && (
                <button
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => removeMember(m.id)}
                >
                  <LuTrash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invite */}
      {isOwner && (
        <div className="card card-border bg-base-100">
          <div className="card-body gap-4">
            <h2 className="font-semibold text-sm">Pakviesti narį</h2>
            <form onSubmit={sendInvite} className="flex gap-2">
              <input
                type="email"
                className="input input-bordered input-sm flex-1"
                placeholder="el@pastas.lt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={sending}
              >
                {sending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "Pakviesti"
                )}
              </button>
            </form>

            {invites.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-base-content/50">Laukiantys kvietimai</p>
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="flex-1 truncate text-base-content/70">
                      {inv.email}
                    </span>
                    <button
                      className="btn btn-ghost btn-xs gap-1"
                      onClick={() => copyLink(inv.token)}
                    >
                      <LuCopy size={12} />
                      Nuoroda
                    </button>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => revokeInvite(inv.id)}
                    >
                      <LuTrash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
