"use client";
import { Profile } from "@/hooks/useProfile";
import Link from "next/link";
import Image from "next/image";
import React, { useState } from "react";

export function UserCard({ profile }: { profile: Partial<Profile> }) {
  // Fall back to initials if the avatar URL is stale/unreachable (e.g. an
  // expired Google avatar) instead of showing a broken image.
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatar = !!profile.avatar_url && !avatarFailed;

  // Whole card is the link — people expect to click the card, not just a button.
  return (
    <Link
      href={`/users/${profile.id}`}
      className="card bg-base-100 shadow-sm overflow-hidden transition-shadow hover:shadow-md"
    >
      <div className="h-28 flex items-center justify-center bg-base-200">
        {showAvatar ? (
          <div className="avatar">
            <div className="w-20 rounded-full">
              <Image
                src={profile.avatar_url!}
                alt={profile.display_name ?? ""}
                width={80}
                height={80}
                className="w-full h-full object-cover"
                onError={() => setAvatarFailed(true)}
              />
            </div>
          </div>
        ) : (
          <div className="avatar avatar-placeholder">
            <div className="bg-primary text-primary-content w-20 rounded-full">
              <span className="text-3xl">
                {profile.display_name?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="card-body p-3 gap-2">
        <h2 className="card-title text-sm leading-tight line-clamp-1">
          {profile.display_name}
        </h2>
      </div>
    </Link>
  );
}
