"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { PartnerProduct } from "@/types/partner";
import { LuPencil, LuTrash2, LuExternalLink } from "react-icons/lu";
import toast from "react-hot-toast";

export function ProductTable({
  products,
  onEdit,
  onDeleted,
}: {
  products: PartnerProduct[];
  onEdit: (p: PartnerProduct) => void;
  onDeleted: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supabase = createClient();

  async function handleDelete(id: string) {
    if (!confirm("Ištrinti šį produktą?")) return;
    setDeletingId(id);
    const { error } = await supabase
      .from("partner_products")
      .delete()
      .eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error("Nepavyko ištrinti.");
    } else {
      onDeleted(id);
    }
  }

  if (products.length === 0) {
    return (
      <div className="card card-border bg-base-100">
        <div className="card-body items-center text-center text-base-content/50 py-16">
          <p>Produktų dar nėra.</p>
          <p className="text-sm">Pridėkite produktą arba importuokite CSV.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-border bg-base-100 overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Produktas</th>
            <th>SKU</th>
            <th>Kaina</th>
            <th>Statusas</th>
            <th className="w-20"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="hover">
              <td>
                <div className="flex items-center gap-3">
                  {p.image_url ? (
                    <div className="avatar">
                      <div className="w-10 rounded-lg">
                        <img src={p.image_url} alt={p.title} />
                      </div>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-base-200 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-sm line-clamp-1">{p.title}</p>
                    {p.product_url && (
                      <a
                        href={p.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                      >
                        Nuoroda <LuExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-sm text-base-content/60">{p.sku ?? "—"}</td>
              <td className="text-sm">
                {p.price != null
                  ? `${Number(p.price).toFixed(2)} ${p.currency}`
                  : "—"}
              </td>
              <td>
                <span
                  className={`badge badge-sm ${
                    p.is_active ? "badge-success" : "badge-ghost"
                  }`}
                >
                  {p.is_active ? "Aktyvus" : "Neaktyvus"}
                </span>
              </td>
              <td>
                <div className="flex gap-1 justify-end">
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => onEdit(p)}
                  >
                    <LuPencil size={13} />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                  >
                    {deletingId === p.id ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <LuTrash2 size={13} />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
