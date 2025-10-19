"use client";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useRef, useState } from "react";

export function CreateWishlist({ user }: { user: User | null }) {
  const supabase = createClient();
  const modalRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();

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
    <div>
      <button className="btn" onClick={openModal}>
        + Create New Board
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
              <button className="btn btn-error" onClick={closeModal}>
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
