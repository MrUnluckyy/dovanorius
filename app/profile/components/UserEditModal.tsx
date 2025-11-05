"use client";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { LuPen } from "react-icons/lu";
import { ProfileEditForm } from "./ProfileEditForm";

export function UserEditModal() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Profile");
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
      <button className="btn" onClick={openModal}>
        <LuPen />
        {t("ctaEdit")}
      </button>
      <dialog ref={modalRef} open={isOpen} className="modal">
        <div className="modal-box">
          <ProfileEditForm onCloseModal={closeModal} />
        </div>
      </dialog>
    </>
  );
}
