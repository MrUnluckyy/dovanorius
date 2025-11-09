"use client";
import useProfile from "@/hooks/useProfile";
import { isWithinInterval, subWeeks } from "date-fns";
import { UserAvatar } from "@/app/profile/components/UserAvatar";
import { useFollow } from "@/hooks/useFollow";

export function ProfileBar({
  authUserId,
  userId,
}: {
  authUserId?: string;
  userId?: string;
}) {
  const { isLoading, profile } = useProfile(userId);
  const { isFollowing, follow, unfollow } = useFollow(authUserId, userId);

  if (isLoading) return <div>Loading...</div>;

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
                <span className="badge badge-accent ml-2">Naujas</span>
              )}
            </h2>
            <p className="text-sm">
              {profile?.about ||
                "This user prefers to keep an air of mystery about them."}
            </p>
          </div>
        </div>
        {authUserId && !isOwnProfile && (
          <button
            className="btn btn-primary"
            onClick={isFollowing ? unfollow : follow}
          >
            {isFollowing ? "Unfollow" : "Follow"}
          </button>
        )}
      </div>
    </div>
  );
}
