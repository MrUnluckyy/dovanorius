"use client";

import { forwardRef, useState, useTransition } from "react";
import { LuExternalLink, LuRefreshCw, LuSave, LuSparkles, LuTriangleAlert } from "react-icons/lu";
import toast from "react-hot-toast";
import { generateArticle, saveArticle } from "../article-actions";
import type { ArticleDraft } from "@/lib/editorial/article";
import type { EditorialShelf } from "../../_lib/types";

/**
 * Turn the shelf into a blog gift guide: Claude drafts the copy, admin reads it
 * here, and only "Išsaugoti juodraštį" creates anything — a Sanity draft that
 * still has to be published by hand in the Studio.
 */
export const ArticleDialog = forwardRef<HTMLDialogElement, { shelf: EditorialShelf }>(
  function ArticleDialog({ shelf }, ref) {
    const [angle, setAngle] = useState("");
    const [showPrice, setShowPrice] = useState(false);
    const [draft, setDraft] = useState<ArticleDraft | null>(null);
    const [canSave, setCanSave] = useState(true);
    const [studioUrl, setStudioUrl] = useState<string | null>(null);
    const [writing, startWriting] = useTransition();
    const [saving, startSaving] = useTransition();

    function write() {
      setStudioUrl(null);
      startWriting(async () => {
        const res = await generateArticle(shelf.id, { angle, showPrice });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setDraft(res.draft);
        setCanSave(res.canSave);
      });
    }

    function save() {
      if (!draft) return;
      startSaving(async () => {
        const res = await saveArticle(draft);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setStudioUrl(res.studioUrl);
        toast.success("Juodraštis išsaugotas Sanity.");
      });
    }

    const busy = writing || saving;

    return (
      <dialog ref={ref} className="modal">
        <div className="modal-box max-w-3xl">
          <h3 className="font-heading text-lg font-bold">Straipsnis tinklaraščiui</h3>
          <p className="text-sm text-base-content/60">
            Dovanų gidas iš šios lentynos prekių. Išsaugomas kaip juodraštis –
            publikuojate patys Sanity Studio.
          </p>

          <label className="form-control mt-4 w-full">
            <span className="label-text text-sm">Kampas (nebūtina)</span>
            <input
              className="input input-bordered w-full"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="pvz. Kalėdos mamai, kuri turi viską; dovanos iki 30 €"
              disabled={busy}
            />
          </label>
          <label className="label mt-1 cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              disabled={busy}
            />
            <span className="text-sm">Rodyti apytikslę kainą (pvz. „~ 30–50 €“)</span>
          </label>

          <div className="mt-3">
            <button
              className="btn btn-primary btn-sm gap-1"
              onClick={write}
              disabled={busy}
              data-busy={writing || undefined}
            >
              {draft ? <LuRefreshCw size={14} /> : <LuSparkles size={14} />}
              {writing ? "Rašoma… (iki minutės)" : draft ? "Parašyti iš naujo" : "Parašyti straipsnį"}
            </button>
          </div>

          {draft && (
            <article className="mt-5 max-h-[50vh] space-y-3 overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-5">
              <p className="text-xs text-base-content/50">
                /blog/{draft.slug} · SEO: {draft.metaTitle}
              </p>
              <h2 className="font-heading text-2xl font-bold">{draft.title}</h2>
              <p className="text-sm italic text-base-content/70">{draft.excerpt}</p>
              {draft.intro.map((p, i) => (
                <p key={`i${i}`} className="text-sm leading-relaxed">{p}</p>
              ))}
              <ol className="space-y-3">
                {draft.picks.map((pick, i) => {
                  const product = draft.products[i];
                  return (
                    <li key={pick.productId} className="flex gap-3 rounded-lg bg-base-200 p-3">
                      {product?.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- merchant CDN preview
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-20 w-20 shrink-0 rounded-md bg-white object-contain"
                        />
                      )}
                      <div>
                        <p className="font-semibold">{pick.title}</p>
                        <p className="text-sm leading-relaxed text-base-content/80">{pick.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {draft.outro.map((p, i) => (
                <p key={`o${i}`} className="text-sm leading-relaxed">{p}</p>
              ))}
            </article>
          )}

          {draft && !canSave && (
            <div className="alert alert-warning mt-3 py-2 text-sm">
              <LuTriangleAlert size={16} />
              <span>
                Išsaugoti negalima: serveryje nenustatytas SANITY_API_WRITE_TOKEN.
              </span>
            </div>
          )}

          {studioUrl && (
            <div className="alert alert-success mt-3 py-2 text-sm">
              <span>Juodraštis sukurtas. Peržiūrėkite ir publikuokite Sanity Studio.</span>
              <a href={studioUrl} target="_blank" rel="noreferrer" className="btn btn-sm gap-1">
                <LuExternalLink size={13} /> Atidaryti
              </a>
            </div>
          )}

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost btn-sm" disabled={busy}>Uždaryti</button>
            </form>
            {draft && !studioUrl && (
              <button
                className="btn btn-primary btn-sm gap-1"
                onClick={save}
                disabled={busy || !canSave}
                data-busy={saving || undefined}
              >
                <LuSave size={14} /> Išsaugoti juodraštį
              </button>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    );
  }
);
