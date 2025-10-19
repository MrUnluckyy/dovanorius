"use client";
import { createClient } from "@/utils/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useRef } from "react";

export function AddItemModal({ boardId }: { boardId: string }) {
  const [form, setForm] = useState({ title: "", url: "", notes: "" });
  const [isOpen, setIsOpen] = useState(false);
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

  const addItem = useMutation({
    mutationFn: async (payload: {
      title: string;
      url?: string;
      notes?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("items").insert({
        board_id: boardId,
        title: payload.title,
        url: payload.url || null,
        notes: payload.notes || null,
        created_by: user?.id || null,
        status: "wanted",
        priority: "medium",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items", boardId] });
      setForm({ title: "", url: "", notes: "" });
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
              });
            }}
          >
            <h3 className="font-bold text-lg">Add Item!</h3>
            <fieldset className="fieldset w-full">
              <label className="label">Title</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Title *"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />

              <label className="label">Url</label>
              <input
                type="text"
                className="input w-full"
                placeholder="URL (optional)"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />

              <label className="label">Notes</label>
              <textarea
                className="textarea w-full"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
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
