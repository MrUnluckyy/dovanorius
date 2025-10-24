"use client";
import ProductUrlParser from "@/components/ProductUrlParser";
import { useProductImageUpload } from "@/hooks/useImageUpload";
import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useRef } from "react";

export function AddItemModal({ boardId }: { boardId: string }) {
  const [form, setForm] = useState({
    title: "",
    url: "",
    notes: "",
    image_url: "",
  });
  const [parsing, setParsing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const { uploadProductImage } = useProductImageUpload();

  const modalRef = useRef<HTMLDialogElement>(null);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const openModal = () => {
    setIsOpen(true);
    modalRef.current?.showModal();
  };
  const closeModal = () => {
    setIsOpen(false);
    modalRef.current?.close();
  };

  const handleParse = async () => {
    if (!form.url) return;
    setParsing(true);
    try {
      const res = await fetch(
        `/api/parser?url=${encodeURIComponent(form.url)}`
      );
      const data = await res.json();

      console.log("Parsed data", data);
      if (data?.title) {
        setForm((prev) => ({ ...prev, title: data.title }));
      }
      if (data?.description) {
        setForm((prev) => ({ ...prev, notes: data.description }));
      }
      if (data?.images && data.images.length > 0) {
        setForm((prev) => ({ ...prev, image_url: data.images?.[0] }));
      }
    } catch (err) {
      console.error("Error parsing product:", err);
    } finally {
      setParsing(false);
    }
  };

  const addItem = useMutation({
    mutationFn: async (payload: {
      title: string;
      url?: string;
      notes?: string;
      image_url?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("items")
        .insert({
          board_id: boardId,
          title: payload.title,
          url: payload.url || null,
          image_url: payload.image_url || null,
          notes: payload.notes || null,
          created_by: user?.id || null,
          status: "wanted",
          priority: "medium",
        })
        .select()
        .single();
      if (error) throw error;

      if (uploadedImageFile) {
        const imageUrl = await uploadProductImage(uploadedImageFile, data?.id);
        if (imageUrl) {
          await supabase
            .from("items")
            .update({ image_url: imageUrl })
            .eq("id", data.id);
        }
      }
    },
    onSuccess: (data) => {
      console.log("Item added", data);
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      setForm({ title: "", url: "", notes: "", image_url: "" });
      closeModal();
    },
  });

  return (
    <>
      <button className="btn" onClick={openModal}>
        + Add Item
      </button>
      <dialog ref={modalRef} open={isOpen} className="modal">
        <div className="modal-box">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.title.trim()) return;
              addItem.mutate({
                title: form.title.trim(),
                url: form.url,
                notes: form.notes,
                image_url: form.image_url,
              });
            }}
          >
            <h3 className="font-bold text-lg">Add Item!</h3>
            <fieldset className="fieldset w-full">
              <ProductUrlParser
                onParse={handleParse}
                onChange={(e) => setForm({ ...form, url: e })}
                loading={parsing}
                value={form.url}
              />
              <label className="label">Title</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Title *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />

              <label className="label">Notes</label>
              <textarea
                className="textarea w-full"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <div>
                {form.image_url ? (
                  <img src={form.image_url} alt={form.title} />
                ) : null}
              </div>

              <label className="label">Image</label>
              <input
                type="file"
                className="file-input w-full"
                onChange={(e) =>
                  setUploadedImageFile(
                    e.target.files ? e.target.files[0] : null
                  )
                }
              />
              <label className="label">Max size 2MB</label>
            </fieldset>
            <div className="modal-action">
              <button className="btn btn-error" onClick={closeModal}>
                Close
              </button>
              <button className="btn" type="submit">
                Submit
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
