"use client";
import useProfile from "@/hooks/useProfile";
import { isWithinInterval, subWeeks } from "date-fns";
import { UserAvatar } from "@/app/profile/components/UserAvatar";
import { UserLoadingSkeleton } from "@/components/loaders/UserLoadingSkeleton";

export function UserBar() {
  const { isLoading, profile } = useProfile();

  const isNewUser =
    profile?.created_at &&
    isWithinInterval(new Date(profile.created_at), {
      start: subWeeks(new Date(), 1),
      end: new Date(),
    });

  if (isLoading || !profile) return <UserLoadingSkeleton />;

  return (
    <div className="flex gap-4 justify-between">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12">
        <div className="avatar">
          <div className="w-40 rounded-full">
            <UserAvatar size="40" avatarUrl={profile?.avatar_url} />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-4xl font-semibold mb-2">
              {profile?.display_name || "Anonimus User"}
              {isNewUser && (
                <span className="badge badge-accent ml-2">New</span>
              )}
            </h2>
            <p className="text-sm">
              {profile?.about ||
                "This user prefers to keep an air of mystery about them."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
