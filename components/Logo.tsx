import Link from "next/link";
import React from "react";

type Props = {
  size?: "sm" | "md" | "lg";
};

export function Logo({ size = "md" }: Props) {
  const getSize = () => {
    if (size === "sm") return "text-lg";
    if (size === "md") return "text-2xl";
    if (size === "lg") return "text-6xl";
  };
  return (
    <div>
      <Link href="/" className={`btn btn-ghost ${getSize()}`}>
        :D noriu
      </Link>
    </div>
  );
}
