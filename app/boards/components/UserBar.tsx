"use client";
import useProfile from "@/hooks/useProfile";
import { isWithinInterval, subWeeks } from "date-fns";
import { UserAvatar } from "@/app/dashboard/components/user/UserAvatar";
import { UserLoadingSkeleton } from "@/components/loaders/UserLoadingSkeleton";
import { LuShare } from "react-icons/lu";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function UserBar() {
  const { isLoading, profile } = useProfile();
  const [copied, setCopied] = useState(false);
  const t = useTranslations("Boards");

  const handleCopy = async () => {
    if (!profile?.id) return;
    const url = `${window.location.origin}/users/${profile.id}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isNewUser =
    profile?.created_at &&
    isWithinInterval(new Date(profile.created_at), {
      start: subWeeks(new Date(), 1),
      end: new Date(),
    });

  if (isLoading || !profile) return <UserLoadingSkeleton />;

  return (
    <div className="flex gap-4 justify-between w-full">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12 w-full">
        <div className="avatar">
          <div className="w-40 rounded-full">
            <UserAvatar size="40" avatarUrl={profile?.avatar_url} />
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 w-full">
          <div>
            <h2 className="text-4xl font-semibold mb-2 font-heading">
              {profile?.display_name || "Anonimus User"}
              {isNewUser && (
                <span className="badge badge-accent ml-2">New</span>
              )}
            </h2>
            {profile?.about && <p className="text-sm">{profile?.about}</p>}
          </div>
          <div>
            <button
              className={`btn ${copied ? "btn-success" : ""}`}
              onClick={handleCopy}
            >
              <LuShare />
              {copied ? t("copied") : t("shareUser")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
