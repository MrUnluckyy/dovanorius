import Image from "next/image";
import Link from "next/link";
import React from "react";

type Props = {
  size?: "sm" | "md" | "lg";
};

export function Logo({ size = "md" }: Props) {
  const getFontSize = () => {
    if (size === "sm") return "text-lg";
    if (size === "md") return "text-2xl";
    if (size === "lg") return "text-4xl";
  };
  const getLogoSize = () => {
    if (size === "sm") return 40;
    if (size === "md") return 60;
    if (size === "lg") return 100;
  };
  return (
    <div>
      <Link
        href="/"
        className={`btn btn-ghost ${getFontSize()} mx-0 px-0 font-heading`}
      >
        <Image
          src="/assets/logo.png"
          alt="Logo"
          width={getLogoSize()}
          height={getLogoSize()}
        />
        Noriuto.lt
      </Link>
    </div>
  );
}
