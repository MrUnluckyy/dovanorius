"use client";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FormEvent, useRef, useState } from "react";
import { LuClipboardPlus } from "react-icons/lu";

export function CreateBoard({ user }: { user: User | null }) {
  const supabase = createClient();
  const modalRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const t = useTranslations("Boards");

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const openModal = () => {
    setIsOpen(true);
    modalRef.current?.showModal();
  };
  const closeModal = () => {
    setIsOpen(false);
    modalRef.current?.close();
  };

  const createBoard = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("boards")
        .insert({ owner_id: user?.id, name, description });
      if (error) throw error;
    },
    onSuccess: () => {
      const userId = user?.id || "";
      queryClient.invalidateQueries({ queryKey: ["boards", userId] });
      setName("");
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createBoard.mutate(name);
    closeModal();
  };

  return (
    <div className="w-full justify-end">
      <button className="btn" onClick={openModal}>
        <LuClipboardPlus />
        {t("ctaCreateBoard")}
      </button>
      <dialog ref={modalRef} open={isOpen} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Add Item!</h3>
          <form onSubmit={handleSubmit}>
            <fieldset className="fieldset w-full ">
              <label className="label">Name</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Boards name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <label className="label">Description</label>
              <textarea
                className="textarea w-full"
                placeholder="Boards description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </fieldset>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-error"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button className="btn" type="submit">
                Save
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}
