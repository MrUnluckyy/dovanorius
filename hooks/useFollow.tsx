"use client";

import { createClient } from "@/utils/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * useFollow
 * @param viewerId current logged in user's id
 * @param targetId the user to follow
 */
export function useFollow(viewerId?: string, targetId?: string) {
  const supabase = createClient();
  const qc = useQueryClient();
  const key = ["follow", viewerId, targetId];

  // 🔍 Check if viewer follows target
  const { data: isFollowing = false, isLoading } = useQuery({
    queryKey: key,
    enabled: !!viewerId && !!targetId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", viewerId)
        .eq("followee_id", targetId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  // ➕ Follow
  const follow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: viewerId, followee_id: targetId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // ➖ Unfollow
  const unfollow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", viewerId)
        .eq("followee_id", targetId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  // 👥 Fetch all followers for this targetId
  const {
    data: followers = [],
    isLoading: followersLoading,
    refetch: refetchFollowers,
  } = useQuery({
    queryKey: ["followers", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select(
          "follower_id, profiles!follows_follower_id_fkey(display_name, avatar_url)"
        )
        .eq("followee_id", targetId);
      if (error) throw error;
      // Flatten data for convenience
      return data.map((f) => {
        const profile = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
        return {
          id: f.follower_id,
          name: profile?.display_name,
          avatar: profile?.avatar_url,
        };
      });
    },
  });

  const {
    data: following = [],
    isLoading: followingLoading,
    refetch,
  } = useQuery({
    queryKey: key,
    enabled: !!viewerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select(
          "followee_id, profiles!follows_followee_id_fkey(display_name, avatar_url)"
        )
        .eq("follower_id", viewerId);

      if (error) throw error;
      return data.map((f) => {
        const profile = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
        return {
          id: f.followee_id,
          display_name: profile?.display_name,
          avatar_url: profile?.avatar_url,
        };
      });
    },
  });

  return {
    isFollowing,
    isLoading,
    follow: () => follow.mutate(),
    unfollow: () => unfollow.mutate(),
    isPending: follow.isPending || unfollow.isPending,
    followers,
    following,
    followersLoading,
    followingLoading,
    refetchFollowers,
  };
}
