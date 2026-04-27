import { Profile } from "@/hooks/useProfile";
import { useTranslations } from "next-intl";
import Link from "next/link";
import React from "react";

export function UserCard({ profile }: { profile: Partial<Profile> }) {
  const t = useTranslations("Dashboard");

  return (
    <div className="card bg-base-100 shadow-sm overflow-hidden">
      <div className="h-28 flex items-center justify-center bg-base-200">
        {profile.avatar_url ? (
          <div className="avatar">
            <div className="w-20 rounded-full">
              <img src={profile.avatar_url} alt={profile.display_name ?? ""} />
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
        <div className="card-actions">
          <Link href={`/users/${profile.id}`} className="btn btn-primary btn-xs w-full">
            {t("openButton")}
          </Link>
        </div>
      </div>
    </div>
  );
}
