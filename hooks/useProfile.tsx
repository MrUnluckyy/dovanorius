"use client";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  about: string | null;
  public: boolean;
  created_at: string;
  /** Optional, self-declared. Seeds the discover audience; never required. */
  gender: "female" | "male" | "other" | null;
  /** Last audience the user chose on discover ("her" | "him" | "everyone"). */
  discover_audience: string | null;
};

// if publicUserId is provided, fetch that user's profile; otherwise, fetch the current user's profile
const useProfile = (publicUserId?: string) => {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  // Only fetch auth user when we *don’t* have a public id
  useEffect(() => {
    if (publicUserId) return;

    const fetchUser = async () => {
      const { data: currentUser, error } = await supabase.auth.getUser();

      if (error) {
        console.error("Error fetching user:", error.message);
        return;
      }

      setUser(currentUser.user);
    };

    fetchUser();
  }, [publicUserId, supabase]);

  const userId = publicUserId || user?.id;

  const fetchProfile = async () => {
    if (!userId) throw new Error("No user id provided");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return data as Profile;
  };

  const {
    data: profile,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["profile", userId], // 👈 key per *actual* profile id
    queryFn: fetchProfile,
    enabled: !!userId, // 👈 don’t run until we know the id
  });

  const editProfile = async (updatedProfile: Partial<Profile>) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updatedProfile)
      .eq("id", user.id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Invalidate the logged-in user’s profile cache
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });

    return data as Profile;
  };

  return { profile, isLoading, isFetching, error, editProfile };
};

export default useProfile;
