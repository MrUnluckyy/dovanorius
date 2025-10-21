"use client";
import useProfile, { Profile } from "@/hooks/useProfile";
import { useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import AvatarUploader from "./AvatarUpload";
import ThemeSelector from "@/components/ThemeSelector";

export function ProfileEditForm() {
  const { profile, isLoading, editProfile } = useProfile();

  const { register, handleSubmit, reset } = useForm<Profile>({
    defaultValues: {
      display_name: profile?.display_name || "NOT SET",
      about: profile?.about || "",
    },
  });

  const onSubmit: SubmitHandler<Profile> = (data) => editProfile(data);

  useEffect(() => {
    if (profile) {
      reset(profile);
    }
  }, [profile, reset]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8">
        <h2 className="text-2xl">Edit Profile</h2>
      </div>
      <div>
        <AvatarUploader profile={profile} />
      </div>
      <ThemeSelector />
      <div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4">
            <legend className="fieldset-legend">Edit User</legend>

            <label className="label">Display Name</label>
            <input
              type="text"
              className="input"
              placeholder="Display name"
              {...register("display_name")}
            />

            <label className="label">About</label>
            <textarea
              className="textarea"
              placeholder="Short info about you"
              {...register("about")}
            />
            <button type="submit" className="btn">
              {isLoading ? "Saving..." : "Save"}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
