"use client";
import { shareLinks } from "@/lib/appLinks";
import useProfile from "@/hooks/useProfile";
import { UserAvatar } from "@/app/mano/components/user/UserAvatar";
import { UserLoadingSkeleton } from "@/components/loaders/UserLoadingSkeleton";
import { LuShare } from "react-icons/lu";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { UserEditModal } from "@/app/mano/components/user/UserEditModal";

/**
 * Who you are, compactly — the dashboard is for your boards, so the header
 * no longer takes the first screen (it was a 160px avatar above everything).
 */
export function DashboardUser() {
  const { isLoading, profile } = useProfile();
  const t = useTranslations("Boards");
  const td = useTranslations("Dashboard");

  const handleCopy = async () => {
    if (!profile?.id) return;
    const url = `${window.location.origin}${shareLinks.profile(profile.id)}`;

    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch (err) {
      toast.error(t("copyFailed"));
      console.error("Failed to copy:", err);
    }
  };

  if (isLoading || !profile) return <UserLoadingSkeleton />;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="avatar shrink-0">
          <div className="w-16 rounded-full ring-2 ring-(--nr-yellow) ring-offset-2 ring-offset-(--nr-cream) sm:w-20">
            <UserAvatar size="20" avatarUrl={profile?.avatar_url} />
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="font-heading truncate text-2xl font-bold sm:text-3xl">
            {profile?.display_name || td("anonymousName")}
          </h1>
          {profile?.about && (
            <p className="line-clamp-2 text-sm text-(--nr-muted)">{profile.about}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-outline btn-sm" onClick={handleCopy}>
          <LuShare />
          {td("shareProfile")}
        </button>
        <UserEditModal />
      </div>
    </div>
  );
}
