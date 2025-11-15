"use client";
import useProfile from "@/hooks/useProfile";
import { isWithinInterval, subWeeks } from "date-fns";
import { UserAvatar } from "@/app/dashboard/components/user/UserAvatar";
import { useFollow } from "@/hooks/useFollow";
import { LuShare, LuUserMinus, LuUserPlus } from "react-icons/lu";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { UserLoadingSkeleton } from "@/components/loaders/UserLoadingSkeleton";

export function ProfileBar({
  authUserId,
  userId,
}: {
  authUserId?: string;
  userId?: string;
}) {
  const { isLoading, profile } = useProfile(userId);
  const { isFollowing, follow, unfollow } = useFollow(authUserId, userId);
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

  if (isLoading) return <UserLoadingSkeleton />;

  const isNewUser =
    profile?.created_at &&
    isWithinInterval(new Date(profile.created_at), {
      start: subWeeks(new Date(), 1),
      end: new Date(),
    });

  const isOwnProfile = authUserId === userId;

  return (
    <div className="flex justify-center items-center gap-4">
      <div className="flex flex-col items-center gap-6 ">
        <div className="avatar">
          <div className="rounded-full">
            <UserAvatar size="40" avatarUrl={profile?.avatar_url} />
          </div>
        </div>
        <div className="flex flex-col md:flex-row justify-between w-full gap-6">
          <div>
            <h2 className="text-4xl font-semibold mb-2">
              {profile?.display_name || "Anonimus User"}
              {isNewUser && (
                <span className="badge badge-accent ml-2">
                  Naujas vartotojas
                </span>
              )}
            </h2>
            <p className="text-sm">{profile?.about}</p>
          </div>
        </div>
        <div className="flex gap-4">
          {authUserId && !isOwnProfile && (
            <button
              className="btn btn-primary"
              onClick={isFollowing ? unfollow : follow}
            >
              {isFollowing ? <LuUserMinus /> : <LuUserPlus />}
              {isFollowing ? t("unfollow") : t("follow")}
            </button>
          )}
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
  );
}
