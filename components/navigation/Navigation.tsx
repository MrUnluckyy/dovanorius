import React from "react";
import ThemeSelector from "../ThemeSelector";
import Link from "next/link";

export function Navigation() {
  return (
    <div className="navbar bg-base-100 shadow-sm">
      <div className="max-w-[1440px] w-full mx-auto">
        <div className="navbar-start">
          <Link href="/" className="btn btn-ghost text-xl">
            :D noriu
          </Link>
        </div>

        <div className="navbar-end">
          <a className="btn">Login</a>
          <a className="btn">Register</a>
          <ThemeSelector />
        </div>
      </div>
    </div>
  );
}
