import { User } from "@supabase/supabase-js";
import Link from "next/link";
import React from "react";

export function SimpleHero({ user }: { user: User | null }) {
  return (
    <div className="hero bg-base-200 min-h-screen">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold">Hello there 👋</h1>
          <p className="py-6">
            Welcome to Dovanoriu, your personal wish list manager. Start adding
            your wishes and share them with friends and family!
          </p>
          {user?.id ? (
            <Link href={`/boards`} className="btn btn-primary">
              Add a Wish!
            </Link>
          ) : (
            <Link href={`/boards`} className="btn btn-primary">
              See Wishlists
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
