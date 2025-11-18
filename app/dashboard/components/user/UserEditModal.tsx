"use client";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { LuPen, LuX } from "react-icons/lu";
import { ProfileEditForm } from "./ProfileEditForm";

export function UserEditModal() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Profile");
  const modalRef = useRef<HTMLDialogElement>(null);

  const openModal = () => {
    setIsOpen(true);
    modalRef.current?.show();
  };
  const closeModal = () => {
    setIsOpen(false);
    modalRef.current?.close();
  };

  return (
    <>
      <button className="btn" onClick={openModal}>
        <LuPen />
        {t("ctaEdit")}
      </button>
      <dialog ref={modalRef} open={isOpen} className="modal">
        <div className="modal-box">
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={closeModal}
            about="Uždaryti modalą"
          >
            <LuX className="text-lg" />
          </button>
          <ProfileEditForm onCloseModal={closeModal} />
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>uždaryti</button>
        </form>
      </dialog>
    </>
  );
}
