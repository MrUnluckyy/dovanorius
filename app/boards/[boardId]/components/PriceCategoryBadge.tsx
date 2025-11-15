import React from "react";
import { LuEuro } from "react-icons/lu";

export default function PriceCategoryBadge({
  price,
}: {
  price: number | null;
}) {
  return (
    <div className="badge badge-accent absolute top-2 left-2 gap-0">
      <LuEuro />
      {price}
    </div>
  );
}
