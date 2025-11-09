"use client";
import { useFollow } from "@/hooks/useFollow";
import { UserCard } from "./UserCard";
import { BoardsLoadingSkeleton } from "@/components/loaders/BoardsLoadingSkeleton";

export function FollowingList({ userId }: { userId: string }) {
  const { following, followingLoading } = useFollow(userId);

  if (followingLoading) return <BoardsLoadingSkeleton />;

  return (
    <div className="my-8">
      <h2 className="font-heading text-2xl font-bold">Aš seku:</h2>
      {following.length === 0 ? (
        <p className="mt-4">Jūs nesekate jokių vartotojų.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {following.map((profile) => (
            <UserCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
