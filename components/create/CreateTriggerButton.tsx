// app/components/CreateTriggerButton.tsx
"use client";

import { useState } from "react";
import { CreateModal } from "./CreateModal";
import { LuPlus } from "react-icons/lu";
import { useTranslations } from "next-intl";

export function CreateTriggerButton({
  className = "btn btn-primary",
  iconOnly = false,
}: {
  className?: string;
  /** Phones: a round "+" with the label kept for screen readers. */
  iconOnly?: boolean;
} = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const t = useTranslations("Actions");

  return (
    <>
      <button
        className={className}
        onClick={() => setIsOpen(true)}
        aria-label={iconOnly ? t("add") : undefined}
      >
        <LuPlus className={iconOnly ? "h-5 w-5" : undefined} />
        {!iconOnly && <span>{t("add")}</span>}
      </button>

      <CreateModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
