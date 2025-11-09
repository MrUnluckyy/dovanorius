import { Profile } from "@/hooks/useProfile";
import Link from "next/link";
import React from "react";

export function UserCard({ profile }: { profile: Partial<Profile> }) {
  return (
    <div className="card bg-base-300 card-xs shadow-sm">
      <div className="card-body justify-center items-center gap-6">
        <h2 className="card-title">{profile.display_name}</h2>

        {profile.avatar_url ? (
          <div className="avatar">
            <div className="w-24 rounded-full">
              <img src={profile?.avatar_url} />
            </div>
          </div>
        ) : (
          <div className="avatar avatar-placeholder">
            <div className="bg-neutral text-neutral-content w-24 rounded-full">
              <span className="text-3xl">
                {profile.display_name?.charAt(0)}
              </span>
            </div>
          </div>
        )}

        <div className="justify-end card-actions">
          <Link href={`/users/${profile.id}`} className="btn btn-primary">
            Atidaryti
          </Link>
        </div>
      </div>
    </div>
  );
}
