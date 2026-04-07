"use client";
import { useState } from "react";
import type { PartnerProduct } from "@/types/partner";
import { ProductTable } from "./ProductTable";
import { BulkUploadModal } from "./BulkUploadModal";
import { ProductFormModal } from "./ProductFormModal";
import { LuPlus, LuUpload } from "react-icons/lu";

export function ProductsClient({
  products: initial,
  partnerId,
}: {
  products: PartnerProduct[];
  partnerId: string;
}) {
  const [products, setProducts] = useState(initial);
  const [showUpload, setShowUpload] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PartnerProduct | null>(null);

  function onSaved(product: PartnerProduct, isNew: boolean) {
    if (isNew) {
      setProducts((p) => [product, ...p]);
    } else {
      setProducts((p) => p.map((x) => (x.id === product.id ? product : x)));
    }
  }

  function onDeleted(id: string) {
    setProducts((p) => p.filter((x) => x.id !== id));
  }

  function onBulkImported(imported: PartnerProduct[]) {
    setProducts((p) => [...imported, ...p]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">
          Produktai{" "}
          <span className="text-base-content/40 font-normal text-lg">
            ({products.length})
          </span>
        </h1>
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm gap-1"
            onClick={() => setShowUpload(true)}
          >
            <LuUpload size={15} />
            Importuoti CSV
          </button>
          <button
            className="btn btn-primary btn-sm gap-1"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <LuPlus size={15} />
            Pridėti
          </button>
        </div>
      </div>

      <ProductTable
        products={products}
        onEdit={(p) => {
          setEditing(p);
          setShowForm(true);
        }}
        onDeleted={onDeleted}
      />

      {showForm && (
        <ProductFormModal
          partnerId={partnerId}
          product={editing}
          onClose={() => setShowForm(false)}
          onSaved={onSaved}
        />
      )}

      {showUpload && (
        <BulkUploadModal
          partnerId={partnerId}
          onClose={() => setShowUpload(false)}
          onImported={onBulkImported}
        />
      )}
    </div>
  );
}
