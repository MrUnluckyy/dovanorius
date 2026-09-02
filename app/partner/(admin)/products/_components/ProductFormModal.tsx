"use client";
import { useEffect, useRef, useState } from "react";
import type { PartnerProduct } from "@/types/partner";
import toast from "react-hot-toast";
import { createPartnerProduct, updatePartnerProduct } from "../actions";

type FormData = {
  title: string;
  description: string;
  price: string;
  currency: string;
  image_url: string;
  product_url: string;
  sku: string;
  is_active: boolean;
  min_age: string;
  max_age: string;
  gender: "male" | "female" | "";
  categories: string;
};

const empty: FormData = {
  title: "",
  description: "",
  price: "",
  currency: "EUR",
  image_url: "",
  product_url: "",
  sku: "",
  is_active: true,
  min_age: "",
  max_age: "",
  gender: "",
  categories: "",
};

export function ProductFormModal({
  product,
  onClose,
  onSaved,
}: {
  product: PartnerProduct | null;
  onClose: () => void;
  onSaved: (p: PartnerProduct, isNew: boolean) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<FormData>(
    product
      ? {
          title: product.title,
          description: product.description ?? "",
          price: product.price != null ? String(product.price) : "",
          currency: product.currency,
          image_url: product.image_url ?? "",
          product_url: product.product_url ?? "",
          sku: product.sku ?? "",
          is_active: product.is_active,
          min_age: product.min_age != null ? String(product.min_age) : "",
          max_age: product.max_age != null ? String(product.max_age) : "",
          gender: product.gender ?? "",
          categories: product.categories.join(", "),
        }
      : empty
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  function set(field: keyof FormData, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    // Raw form values; the server action validates, normalises, derives the
    // partner from membership, and forces status = 'pending'.
    const input = {
      title: form.title,
      description: form.description,
      price: form.price,
      currency: form.currency,
      image_url: form.image_url,
      product_url: form.product_url,
      sku: form.sku,
      is_active: form.is_active,
      min_age: form.min_age,
      max_age: form.max_age,
      gender: form.gender || null,
      categories: form.categories
        ? form.categories.split(",").map((c) => c.trim()).filter(Boolean)
        : [],
    };

    const res = product
      ? await updatePartnerProduct(product.id, input)
      : await createPartnerProduct(input);
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onSaved(res.product, !product);

    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-lg">
        <h3 className="font-heading font-bold text-lg mb-1">
          {product ? "Redaguoti produktą" : "Naujas produktas"}
        </h3>
        <p className="text-xs text-base-content/50 mb-4">
          {product
            ? "Pakeitus produktą jis bus iš naujo peržiūrimas prieš rodant sraute."
            : "Naujas produktas bus peržiūrimas prieš rodant Discover sraute."}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label label-text text-xs">Pavadinimas *</label>
            <input
              className="input input-bordered w-full input-sm"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label label-text text-xs">Aprašymas</label>
            <textarea
              className="textarea textarea-bordered w-full textarea-sm"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label label-text text-xs">Kaina</label>
              <input
                className="input input-bordered w-full input-sm"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label label-text text-xs">Valiuta</label>
              <select
                className="select select-bordered w-full select-sm"
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label label-text text-xs">SKU</label>
            <input
              className="input input-bordered w-full input-sm"
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
            />
          </div>
          <div>
            <label className="label label-text text-xs">Nuotraukos URL</label>
            <input
              className="input input-bordered w-full input-sm"
              type="url"
              value={form.image_url}
              onChange={(e) => set("image_url", e.target.value)}
            />
          </div>
          <div>
            <label className="label label-text text-xs">Produkto nuoroda</label>
            <input
              className="input input-bordered w-full input-sm"
              type="url"
              value={form.product_url}
              onChange={(e) => set("product_url", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
            />
            <label htmlFor="is_active" className="text-sm cursor-pointer">
              Aktyvus
            </label>
          </div>

          <div className="divider text-xs text-base-content/40 my-1">Tikslinė auditorija</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label label-text text-xs">Amžius nuo</label>
              <input
                className="input input-bordered w-full input-sm"
                type="number"
                min="0"
                max="120"
                placeholder="pvz. 18"
                value={form.min_age}
                onChange={(e) => set("min_age", e.target.value)}
              />
            </div>
            <div>
              <label className="label label-text text-xs">Amžius iki</label>
              <input
                className="input input-bordered w-full input-sm"
                type="number"
                min="0"
                max="120"
                placeholder="pvz. 35"
                value={form.max_age}
                onChange={(e) => set("max_age", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label label-text text-xs">Lytis</label>
            <select
              className="select select-bordered w-full select-sm"
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
            >
              <option value="">Visi</option>
              <option value="female">Moterys</option>
              <option value="male">Vyrai</option>
            </select>
          </div>

          <div>
            <label className="label label-text text-xs">Kategorijos</label>
            <input
              className="input input-bordered w-full input-sm"
              placeholder="pvz. sportas, technika, namai"
              value={form.categories}
              onChange={(e) => set("categories", e.target.value)}
            />
            <p className="text-xs text-base-content/40 mt-1">Atskirkite kableliu</p>
          </div>

          <div className="modal-action mt-6">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => { dialogRef.current?.close(); onClose(); }}
            >
              Atšaukti
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving}
              data-busy={saving || undefined}
            >
              Išsaugoti
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
