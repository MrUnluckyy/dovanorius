// app/components/CreateTriggerButton.tsx
"use client";

import { useState } from "react";
import { CreateModal } from "./CreateModal";
import { LuPlus } from "react-icons/lu";

export function CreateTriggerButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="btn btn-primary" onClick={() => setIsOpen(true)}>
        <LuPlus /> Pridėti
      </button>

      <CreateModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
