"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { LuArrowLeft, LuImageUp, LuSearch, LuTrash2, LuX } from "react-icons/lu";
import { searchProducts, type ProductHit } from "@/app/admin/editorial/actions";
import { fromLocalInput, toLocalInput } from "@/app/admin/editorial/_lib/dates";
import { RECIPIENT_KEYS } from "@/lib/discover/recipients";
import { CATEGORY_SLUGS } from "@/lib/discover/routes";
import { StoryBlock } from "@/app/idejos/_components/hub/StoryBlock";
import type { CardProduct } from "@/app/idejos/_components/ProductCard";
import {
  createPlacement,
  deletePlacement,
  setPlacementActive,
  updatePlacement,
  createPlacementUpload,
} from "../actions";
import { createClient } from "@/utils/supabase/client";
import type { PlacementRow } from "../_lib/load";

const toCard = (p: ProductHit): CardProduct => ({
  id: p.id,
  title: p.product_name,
  brand: p.brand_name,
  price: p.price,
  imageUrl: p.image_url,
  deepLink: null,
});

/**
 * Create or edit one sponsored placement. The preview at the bottom is the
 * real StoryBlock, so what the admin sees is what the advertiser gets.
 */
export function PlacementForm({
  placement,
  products: initialProducts,
}: {
  placement: PlacementRow | null;
  products: ProductHit[];
}) {
  const t = useTranslations("Discover");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const deleteRef = useRef<HTMLDialogElement>(null);

  const [advertiser, setAdvertiser] = useState(placement?.advertiser ?? "");
  const [headline, setHeadline] = useState(placement?.headline ?? "");
  const [body, setBody] = useState(placement?.body ?? "");
  const [imageUrl, setImageUrl] = useState(placement?.image_url ?? "");
  const [ctaLabel, setCtaLabel] = useState(placement?.cta_label ?? "Apsilankyti");
  const [ctaUrl, setCtaUrl] = useState(placement?.cta_url ?? "https://");
  const [products, setProducts] = useState<ProductHit[]>(initialProducts);
  const [recipients, setRecipients] = useState<string[]>(placement?.recipients ?? []);
  const [categories, setCategories] = useState<string[]>(placement?.categories ?? []);
  const [startsAt, setStartsAt] = useState(toLocalInput(placement?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(placement?.ends_at ?? null));
  const [priority, setPriority] = useState(String(placement?.priority ?? 0));

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const ticket = await createPlacementUpload(file.type, file.size);
      if (!ticket.ok) return void toast.error(ticket.error);
      // Straight to storage with the one-time token; the file never goes
      // through a server action (1 MB limit).
      const { error } = await createClient()
        .storage.from("discover-placements")
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
      if (error) return void toast.error("Nepavyko įkelti paveikslėlio.");
      setImageUrl(ticket.publicUrl);
    } catch {
      toast.error("Nepavyko įkelti paveikslėlio.");
    } finally {
      setUploading(false);
    }
  }

  async function runSearch() {
    setSearching(true);
    const res = await searchProducts(query);
    setSearching(false);
    if (!res.ok) return toast.error(res.error);
    setHits(res.hits);
  }

  function handleSave() {
    const input = {
      advertiser,
      headline,
      body,
      imageUrl,
      ctaLabel,
      ctaUrl,
      productIds: products.map((p) => p.id),
      recipients,
      categories,
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
      priority: Number(priority) || 0,
    };
    startTransition(async () => {
      if (placement) {
        const res = await updatePlacement(placement.id, input);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Išsaugota.");
        router.refresh();
      } else {
        const res = await createPlacement(input);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Reklama sukurta.");
        router.push(`/admin/placements/${res.id}`);
      }
    });
  }

  function handleToggle() {
    if (!placement) return;
    startTransition(async () => {
      const res = await setPlacementActive(placement.id, !placement.is_active);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!placement) return;
    startTransition(async () => {
      const res = await deletePlacement(placement.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Ištrinta.");
      router.push("/admin/placements");
    });
  }

  const field = "input input-bordered w-full";
  const chip = (on: boolean) =>
    `btn btn-xs rounded-full ${on ? "btn-neutral" : "btn-ghost border border-base-300"}`;

  return (
    <>
      <Link href="/admin/placements" className="mb-3 inline-flex items-center gap-1 text-sm text-base-content/70 hover:text-base-content">
        <LuArrowLeft size={14} /> Visos reklamos
      </Link>
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-bold">{placement ? "Reklama" : "Nauja reklama"}</h1>
        {placement && (
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={handleToggle} disabled={pending}>
              {placement.is_active ? "Išjungti" : "Įjungti"}
            </button>
            <button className="btn btn-ghost btn-sm text-error" onClick={() => deleteRef.current?.showModal()} disabled={pending}>
              <LuTrash2 size={14} /> Ištrinti
            </button>
          </div>
        )}
      </div>

      <div className="card mt-6 bg-base-100 card-border">
        <div className="card-body gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="form-control">
              <span className="label-text text-sm">Reklamuotojas <span className="text-base-content/65">— rodoma „Remiama · …“</span></span>
              <input className={field} value={advertiser} maxLength={60} onChange={(e) => setAdvertiser(e.target.value)} placeholder="pvz. Mideer" />
            </label>
            <label className="form-control">
              <span className="label-text text-sm">Antraštė</span>
              <input className={field} value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} />
            </label>
          </div>

          <label className="form-control">
            <span className="label-text text-sm">Tekstas <span className="text-base-content/65">({body.length}/280)</span></span>
            <textarea className="textarea textarea-bordered w-full" rows={2} maxLength={280} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>

          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <label className="form-control">
              <span className="label-text text-sm">Mygtuko tekstas</span>
              <input className={field} value={ctaLabel} maxLength={30} onChange={(e) => setCtaLabel(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text text-sm">Nuoroda <span className="text-base-content/65">— https://, atsidaro naujame lange</span></span>
              <input className={field} value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} inputMode="url" />
            </label>
          </div>

          <div>
            <span className="label-text text-sm">Paveikslėlis <span className="text-base-content/65">— geriausia 16:9 (pvz. 1600×900); aukštesnis apkarpomas iki 440 px aukščio, žr. peržiūrą. JPG, PNG, WebP, iki 3 MB</span></span>
            <div className="mt-2 flex items-center gap-3">
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-20 w-auto rounded-lg border border-base-300" />
              )}
              <label className={`btn btn-sm gap-1 ${uploading ? "btn-disabled" : ""}`}>
                <LuImageUp size={14} /> {uploading ? "Įkeliama…" : imageUrl ? "Pakeisti" : "Įkelti"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <span className="label-text text-sm">Produktai <span className="text-base-content/65">({products.length}/6 — eilutė rodoma nuo 4)</span></span>
            {products.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {products.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg border border-base-300 py-1 pl-1 pr-2 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image_url && <img src={p.image_url} alt="" className="h-8 w-8 rounded object-contain" />}
                    <span className="max-w-[16ch] truncate">{p.product_name}</span>
                    {!p.in_stock && <span className="badge badge-xs badge-warning">nėra</span>}
                    <button aria-label="Pašalinti" onClick={() => setProducts(products.filter((x) => x.id !== p.id))}>
                      <LuX size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex gap-2">
              <input
                className={`${field} input-sm`}
                placeholder="Ieškoti produkto…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void runSearch()}
              />
              <button className="btn btn-sm gap-1" onClick={() => void runSearch()} disabled={searching || query.trim().length < 2}>
                <LuSearch size={14} /> Ieškoti
              </button>
            </div>
            {hits.length > 0 && (
              <ul className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-base-300">
                {hits.map((h) => {
                  const picked = products.some((p) => p.id === h.id);
                  return (
                    <li key={h.id} className="flex items-center gap-2 border-b border-base-200 px-2 py-1.5 text-sm last:border-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {h.image_url && <img src={h.image_url} alt="" className="h-9 w-9 rounded object-contain" />}
                      <span className="min-w-0 flex-1 truncate">
                        {h.product_name} <span className="text-base-content/65">· {h.merchant_name} · {h.price} €</span>
                      </span>
                      <button
                        className="btn btn-xs"
                        disabled={picked || products.length >= 6}
                        onClick={() => setProducts([...products, h])}
                      >
                        {picked ? "Pridėta" : "Pridėti"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <span className="label-text text-sm">Gavėjai <span className="text-base-content/65">— nieko nepažymėjus, rodoma visur</span></span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {RECIPIENT_KEYS.map((r) => (
                <button key={r} type="button" className={chip(recipients.includes(r))} onClick={() => toggle(recipients, setRecipients, r)}>
                  {t(`recipient.${r}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label-text text-sm">Kategorijos <span className="text-base-content/65">— pažymėjus, rodoma tik tų kategorijų puslapiuose</span></span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.keys(CATEGORY_SLUGS).map((c) => (
                <button key={c} type="button" className={chip(categories.includes(c))} onClick={() => toggle(categories, setCategories, c)}>
                  {t(`category.${c}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="form-control">
              <span className="label-text text-sm">Rodyti nuo</span>
              <input type="datetime-local" className={field} value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text text-sm">Rodyti iki</span>
              <input type="datetime-local" className={field} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text text-sm">Prioritetas <span className="text-base-content/65">— didesnis laimi</span></span>
              <input type="number" className={field} value={priority} onChange={(e) => setPriority(e.target.value)} />
            </label>
          </div>

          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={pending || uploading}>
              {placement ? "Išsaugoti" : "Sukurti"}
            </button>
          </div>
        </div>
      </div>

      <h2 className="mt-10 font-heading text-lg font-bold">Peržiūra</h2>
      <p className="text-sm text-base-content/70">Taip blokas atrodys Discover puslapyje.</p>
      <div className="mt-4 rounded-2xl bg-(--nr-cream) p-6">
        <StoryBlock
          story={{
            kind: "sponsored",
            label: t("hub.sponsored", { advertiser: advertiser || "…" }),
            title: headline || "Antraštė",
            excerpt: body || null,
            image: imageUrl || null,
            imageAlt: null,
            href: ctaUrl.startsWith("https://") ? ctaUrl : "#",
            ctaLabel: ctaLabel || "Apsilankyti",
          }}
          products={products.map(toCard)}
          onOpen={() => {}}
        />
      </div>

      <dialog ref={deleteRef} className="modal">
        <div className="modal-box">
          <h3 className="font-heading text-lg font-bold">Ištrinti reklamą?</h3>
          <p className="mt-2 text-sm text-base-content/70">
            „{placement?.headline}“ bus ištrinta negrįžtamai. Statistika lieka įvykių lentelėje.
          </p>
          <div className="modal-action">
            <button className="btn btn-ghost btn-sm" onClick={() => deleteRef.current?.close()}>
              Atšaukti
            </button>
            <button className="btn btn-error btn-sm" onClick={handleDelete} disabled={pending}>
              Ištrinti
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
