// app/components/CreateTriggerButton.tsx
"use client";

import { useState } from "react";
import { CreateModal } from "./CreateModal";
import { LuPlus } from "react-icons/lu";
import { useTranslations } from "next-intl";

export function CreateTriggerButton() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Actions");

  return (
    <>
      <button className="btn btn-primary ml-4" onClick={() => setIsOpen(true)}>
        <LuPlus /> <span className="hidden md:inline">{t("add")}</span>
      </button>

      <CreateModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
