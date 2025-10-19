"use client";
import { createClient } from "@/utils/supabase/client";
import { useState } from "react";

export default function ReserveButton({ itemId }: { itemId: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);

  async function reserve() {
    setBusy(true);
    const { data, error } = await supabase.rpc("reserve_item", {
      p_item_id: itemId,
    });
    setOk(!error && data === true);
    setBusy(false);
    if (ok) location.reload();
  }

  async function unreserve() {
    setBusy(true);
    const { data, error } = await supabase.rpc("unreserve_item", {
      p_item_id: itemId,
    });
    setOk(!error && data === true);
    setBusy(false);
    if (ok) location.reload();
  }

  return (
    <div className="flex gap-2">
      <button
        className="text-sm border rounded px-3 py-1"
        disabled={busy}
        onClick={reserve}
      >
        Reserve
      </button>
      <button
        className="text-sm border rounded px-3 py-1"
        disabled={busy}
        onClick={unreserve}
      >
        Unreserve
      </button>
    </div>
  );
}
