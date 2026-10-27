"use client";
import { useFollow } from "@/hooks/useFollow";
import { UserCard } from "./UserCard";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function FollowingList({ userId }: { userId: string }) {
  const { following, followingLoading } = useFollow(userId);
  const t = useTranslations("Dashboard");

  if (followingLoading) return <BoardsLoadingSkeleton />;

  return (
    <div>
      {following.length === 0 ? (
        <EmptyState
          hero="friends"
          title={t("followingEmptyTitle")}
          hint={t("followingEmptyHint")}
          action={
            <Link href="/zmones" className="btn btn-primary">
              {t("followingCta")}
            </Link>
          }
        />
      ) : (
        <>
        <h2 className="font-heading mb-4 text-2xl font-bold">{t("followingTitle")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {following.map((profile) => (
            <UserCard key={profile.id} profile={profile} />
          ))}
        </div>
        </>
      )}
    </div>
  );
}
