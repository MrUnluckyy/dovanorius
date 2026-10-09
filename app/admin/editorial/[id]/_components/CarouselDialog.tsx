"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import { LuCopy, LuDownload, LuRefreshCw, LuTriangleAlert } from "react-icons/lu";
import toast from "react-hot-toast";
import { buildCaption, MAX_PRODUCT_SLIDES } from "@/lib/carousel/copy";
import { ltPlural } from "@/lib/lt-plural";
import type { EditorialPick, EditorialShelf } from "../../_lib/types";

/**
 * Instagram carousel for a shelf: cover, one slide per pick, closing slide.
 * The slides are rendered server-side (see carousel/[slide]/route.ts); this
 * dialog only previews them, holds the caption and hands out the ZIP.
 */
export const CarouselDialog = forwardRef<
  HTMLDialogElement,
  { shelf: EditorialShelf; picks: EditorialPick[]; open: boolean; onClose: () => void }
>(function CarouselDialog({ shelf, picks, open, onClose }, ref) {
  // Same selection as lib/carousel/deck.ts: dropped picks out, first eight in.
  const usable = picks.filter((p) => p.state !== "dropped");
  const shown = usable.slice(0, MAX_PRODUCT_SLIDES);
  const total = shown.length + 2;

  const [showPrice, setShowPrice] = useState(false);
  // Bumped to make the browser fetch fresh slides after picks change.
  const [version, setVersion] = useState(0);
  const defaultCaption = useMemo(
    () =>
      buildCaption(
        shelf.label_lt,
        shelf.description,
        shown.map((p) => ({
          name: p.product_name ?? p.name_snapshot ?? "",
          brand: p.brand_name,
        }))
      ),
    // shown is derived from picks each render; key on what it is built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shelf.label_lt, shelf.description, picks]
  );
  const [caption, setCaption] = useState(defaultCaption);
  useEffect(() => setCaption(defaultCaption), [defaultCaption]);

  const base = `/admin/editorial/${shelf.id}/carousel`;
  const query = `?price=${showPrice ? 1 : 0}&v=${version}`;
  const noImage = shown.filter((p) => !(p.image_url ?? p.image_snapshot)).length;

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Aprašymas nukopijuotas.");
    } catch {
      toast.error("Nepavyko nukopijuoti — pažymėkite tekstą ir kopijuokite ranka.");
    }
  }

  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-box max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-heading text-lg font-bold">Instagram karuselė</h3>
            <p className="text-sm text-base-content/60">
              {total} {ltPlural(total, "skaidrė", "skaidrės", "skaidrių")}, 1080×1350. Įkelkite jas į Instagram tokia tvarka.
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm gap-1"
            onClick={() => setVersion((v) => v + 1)}
            title="Perpiešti skaidres"
          >
            <LuRefreshCw size={14} /> Atnaujinti
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="alert mt-4 text-sm">
            Lentynoje nėra produktų. Pridėkite bent vieną, kad būtų iš ko kurti karuselę.
          </div>
        ) : (
          <>
            {(usable.length > MAX_PRODUCT_SLIDES || noImage > 0) && (
              <div className="alert alert-warning mt-4 py-2 text-sm">
                <LuTriangleAlert size={16} />
                <span>
                  {usable.length > MAX_PRODUCT_SLIDES &&
                    `Instagram leidžia 10 nuotraukų, todėl rodomi pirmi ${MAX_PRODUCT_SLIDES} produktai. Pakeiskite eilę, jei norite kitų. `}
                  {noImage > 0 &&
                    `${noImage} ${ltPlural(noImage, "produktas", "produktai", "produktų")} be nuotraukos — skaidrėje bus tuščia kortelė.`}
                </span>
              </div>
            )}

            {/* Only fetch slides once the dialog is open; each one is a render. */}
            {open && (
              <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-3">
                {Array.from({ length: total }, (_, i) => (
                  <a
                    key={`${i}-${query}`}
                    href={`${base}/${i}${query}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-56 shrink-0 snap-start"
                    title="Atidaryti pilno dydžio"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG route */}
                    <img
                      src={`${base}/${i}${query}`}
                      alt={`Skaidrė ${i + 1}`}
                      width={1080}
                      height={1350}
                      loading="lazy"
                      className="aspect-[4/5] w-full rounded-lg border border-base-300 bg-base-200 object-cover"
                    />
                    <span className="mt-1 block text-center text-xs text-base-content/50">
                      {i + 1}
                    </span>
                  </a>
                ))}
              </div>
            )}

            <label className="label mt-2 cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
              />
              <span className="text-sm">
                Rodyti apytikslę kainą (pvz. „~ 30–50 €“), ne tikslią
              </span>
            </label>

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold">Aprašymas</span>
                <button className="btn btn-ghost btn-xs gap-1" onClick={copyCaption}>
                  <LuCopy size={13} /> Kopijuoti
                </button>
              </div>
              <textarea
                className="textarea textarea-bordered h-48 w-full font-mono text-xs"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-ghost btn-sm">Uždaryti</button>
          </form>
          {shown.length > 0 && (
            <a className="btn btn-primary btn-sm gap-1" href={`${base}/zip${query}`} download>
              <LuDownload size={14} /> Atsisiųsti ZIP
            </a>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
});
