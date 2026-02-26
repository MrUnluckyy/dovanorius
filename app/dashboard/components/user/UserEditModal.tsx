"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LuPen, LuX } from "react-icons/lu";
import { ProfileEditForm } from "./ProfileEditForm";

export function UserEditModal() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Profile");

  const openModal = () => {
    setIsOpen(true);
  };
  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button className="btn btn-outline" onClick={openModal}>
        <LuPen />
        {t("ctaEdit")}
      </button>
      {isOpen && (
        <dialog open={isOpen} className="modal">
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
          <div className="modal-backdrop" onClick={closeModal}>
            <button>uždaryti</button>
          </div>
        </dialog>
      )}
    </>
  );
}
