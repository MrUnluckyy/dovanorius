import React from "react";
import { LuEuro } from "react-icons/lu";

export default function PriceCategoryBadge({
  price,
}: {
  price: number | null;
}) {
  const getPriceCategory = (price: number | null) => {
    if (price === null) {
      return "-";
    } else if (price < 20) {
      return "5-20";
    } else if (price >= 20 && price < 50) {
      return "20-50";
    } else if (price >= 50 && price < 70) {
      return "50-70";
    } else if (price >= 70 && price < 100) {
      return "70-100";
    } else if (price >= 100) {
      return "100+";
    } else {
      return "-";
    }
  };
  return (
    <div className="badge badge-accent absolute top-2 left-2">
      <LuEuro />
      {getPriceCategory(price)}
    </div>
  );
}
