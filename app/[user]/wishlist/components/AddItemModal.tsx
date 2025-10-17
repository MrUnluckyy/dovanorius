"use client";
import React, { useState, useRef } from "react";

export function AddItemModal() {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);

  const openModal = () => {
    setIsOpen(true);
    modalRef.current?.showModal();
  };
  const closeModal = () => {
    setIsOpen(false);
    modalRef.current?.close();
  };

  return (
    <>
      <button className="btn btn-neutral" onClick={openModal}>
        + Add Item
      </button>
      <dialog ref={modalRef} className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Add Item!</h3>

          <fieldset className="fieldset w-full">
            <label className="label">Title</label>
            <input
              type="text"
              className="input"
              placeholder="My awesome page"
            />

            <label className="label">Slug</label>
            <input
              type="text"
              className="input"
              placeholder="my-awesome-page"
            />

            <label className="label">Author</label>
            <input type="text" className="input" placeholder="Name" />
          </fieldset>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn" onClick={closeModal}>
                Close
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
