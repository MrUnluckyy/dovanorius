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
};

// if publicUserId is provided, fetch that user's profile; otherwise, fetch the current user's profile
const useProfile = (publicUserId?: string) => {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: currentUser, error } = await supabase.auth.getUser();

      if (error) {
        console.error("Error fetching user:", error.message);
        return;
      }

      setUser(currentUser.user);
    };
    if (!publicUserId) {
      fetchUser();
    }
  }, []);

  const userId = publicUserId || user?.id;
  console.log("publicUserId", userId);

  const fetchProfile = async () => {
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

  // Edit is possible only with fetched user id
  const editProfile = async (updatedProfile: Partial<Profile>) => {
    if (!user) {
      throw new Error("User not authenticated");
    }
    const { data, error } = await supabase
      .from("profiles")
      .update(updatedProfile)
      .eq("id", user?.id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Invalidate and refetch the profile query to get the updated data
    queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });

    return data as Profile;
  };

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: fetchProfile,
  });
  return { profile, isLoading, error, editProfile };
};

export default useProfile;
