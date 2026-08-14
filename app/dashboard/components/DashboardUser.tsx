"use client";
import useProfile from "@/hooks/useProfile";
import { isWithinInterval, subWeeks } from "date-fns";
import { UserAvatar } from "@/app/dashboard/components/user/UserAvatar";
import { UserLoadingSkeleton } from "@/components/loaders/UserLoadingSkeleton";
import { LuShare } from "react-icons/lu";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { UserEditModal } from "@/app/dashboard/components/user/UserEditModal";

export function DashboardUser() {
  const { isLoading, profile } = useProfile();
  const t = useTranslations("Boards");

  const handleCopy = async () => {
    if (!profile?.id) return;
    const url = `${window.location.origin}/users/${profile.id}`;

    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    } catch (err) {
      toast.error(t("copyFailed"));
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
            <h2 className="text-4xl font-semibold font-heading mb-2">
              {profile?.display_name || "Anonimus User"}
              {isNewUser && (
                <span className="badge badge-accent ml-2">Naujas</span>
              )}
            </h2>
            <p className="text-sm font-body">{profile?.about}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn btn-outline" onClick={handleCopy}>
              <LuShare />
              {t("shareUser")}
            </button>
            <UserEditModal />
          </div>
        </div>
      </div>
    </div>
  );
}
