"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { PartnerProduct } from "@/types/partner";
import toast from "react-hot-toast";

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
  partnerId,
  product,
  onClose,
  onSaved,
}: {
  partnerId: string;
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
  const supabase = createClient();

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

    const payload = {
      partner_id: partnerId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      price: form.price ? parseFloat(form.price) : null,
      currency: form.currency,
      image_url: form.image_url.trim() || null,
      product_url: form.product_url.trim() || null,
      sku: form.sku.trim() || null,
      is_active: form.is_active,
      min_age: form.min_age ? parseInt(form.min_age) : null,
      max_age: form.max_age ? parseInt(form.max_age) : null,
      gender: form.gender || null,
      categories: form.categories
        ? form.categories.split(",").map((c) => c.trim()).filter(Boolean)
        : [],
    };

    if (product) {
      const { data, error } = await supabase
        .from("partner_products")
        .update(payload)
        .eq("id", product.id)
        .select()
        .single();
      setSaving(false);
      if (error) { toast.error("Nepavyko išsaugoti."); return; }
      onSaved(data as PartnerProduct, false);
    } else {
      const { data, error } = await supabase
        .from("partner_products")
        .insert(payload)
        .select()
        .single();
      setSaving(false);
      if (error) { toast.error("Nepavyko sukurti."); return; }
      onSaved(data as PartnerProduct, true);
    }

    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-lg">
        <h3 className="font-heading font-bold text-lg mb-4">
          {product ? "Redaguoti produktą" : "Naujas produktas"}
        </h3>
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
            >
              {saving ? <span className="loading loading-spinner loading-xs" /> : null}
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
