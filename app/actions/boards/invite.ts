"use server";

import { Resend } from "resend";
import { createClient } from "@/utils/supabase/server";
import { BoardInviteEmail } from "@/emails/BoardInviteEmail";

export type CreateInviteResult =
  | {
      ok: true;
      invite: {
        id: string;
        board_id: string;
        email: string | null;
        token: string;
        role: string;
        expires_at: string;
        created_at: string;
      };
      emailSent: boolean;
    }
  | { ok: false; error: string };

const FROM = process.env.RESEND_FROM ?? "Noriuto <labas@noriuto.lt>";

export async function createBoardInvite(
  boardId: string,
  email: string
): Promise<CreateInviteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "invalid_email" };

  // RLS ensures only the board owner can insert an invite for this board.
  const { data: invite, error } = await supabase
    .from("board_invites")
    .insert({ board_id: boardId, email: trimmed, invited_by: user.id })
    .select("id, board_id, email, token, role, expires_at, created_at")
    .single();

  if (error || !invite) {
    return { ok: false, error: error?.message ?? "insert_failed" };
  }

  // Best-effort email; the invite still exists (copy-link) if this fails.
  let emailSent = false;
  try {
    const { data: board } = await supabase
      .from("boards")
      .select("name")
      .eq("id", boardId)
      .single();

    const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "https://noriuto.lt";
    const resend = new Resend(process.env.RESEND_API_KEY);
    // A rejected send resolves with { error } rather than throwing, so
    // emailSent used to be true for invites that never left Resend.
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: trimmed,
      subject: "Kvietimas bendradarbiauti Noriuto lentoje 🎁",
      react: BoardInviteEmail({
        boardName: board?.name ?? "norų lenta",
        joinUrl: `${baseUrl}/boards/join/${invite.token}`,
      }),
    });

    if (sendError) throw sendError;
    emailSent = true;
  } catch (err) {
    console.error("Failed to send board invite email:", err);
  }

  return { ok: true, invite, emailSent };
}
