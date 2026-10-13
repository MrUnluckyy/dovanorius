"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/app/admin/_lib/requireAdmin";
import {
  canSaveToSanity,
  saveArticleDraft,
  writeArticle,
  type ArticleDraft,
} from "@/lib/editorial/article";

export type ArticleResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Errors as Lithuanian text: server-action exceptions reach the client redacted. */
function message(e: unknown): string {
  if (e instanceof Anthropic.RateLimitError) return "Per daug užklausų modeliui – pabandykite po minutės.";
  if (e instanceof Anthropic.AuthenticationError) return "Modelis atmetė prisijungimą (API raktas arba Vercel federacija).";
  if (e instanceof Anthropic.APIError) return `Modelio klaida (${e.status ?? "?"}). Pabandykite dar kartą.`;
  return e instanceof Error ? e.message : "Nežinoma klaida.";
}

export async function generateArticle(
  shelfId: string,
  opts: { angle: string; showPrice: boolean }
): Promise<ArticleResult<{ draft: ArticleDraft; canSave: boolean }>> {
  await requireAdmin();
  try {
    const draft = await writeArticle(shelfId, opts);
    return { ok: true, draft, canSave: canSaveToSanity() };
  } catch (e) {
    console.error("[article] generate failed", e);
    return { ok: false, error: message(e) };
  }
}

export async function saveArticle(draft: ArticleDraft): Promise<ArticleResult<{ studioUrl: string }>> {
  await requireAdmin();
  try {
    return { ok: true, ...(await saveArticleDraft(draft)) };
  } catch (e) {
    console.error("[article] save failed", e);
    return { ok: false, error: message(e) };
  }
}
