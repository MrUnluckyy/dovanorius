"use client";
import useProfile, { Profile } from "@/hooks/useProfile";
import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import AvatarUploader from "./AvatarUpload";
import { useTranslations } from "next-intl";
import { toast } from "react-hot-toast";
import Link from "next/link";

export function ProfileEditForm({
  onCloseModal,
}: {
  onCloseModal: () => void;
}) {
  const { profile, editProfile } = useProfile();
  const [uploading, setUploading] = useState(false);
  const t = useTranslations("Profile");

  const { register, handleSubmit, reset, formState } = useForm<Profile>({
    defaultValues: {
      display_name: profile?.display_name || "NOT SET",
      about: profile?.about || "",
      public: profile?.public || false,
    },
  });

  const onSubmit: SubmitHandler<Profile> = async (data) => {
    setUploading(true);
    try {
      await editProfile({
        display_name: data.display_name,
        about: data.about,
        public: data.public,
      });
      toast.success(t("toastProfileUpdated"));
    } catch (error) {
    } finally {
      setUploading(false);
      onCloseModal();
    }
  };

  useEffect(() => {
    if (profile) {
      reset(profile);
    }
  }, [profile, reset]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-6 w-full">
        <h2 className="text-xl font-bold">{t("editProfile")}</h2>
      </div>

      <AvatarUploader profile={profile} />

      <form onSubmit={handleSubmit(onSubmit)} className="w-full">
        <fieldset className="fieldset w-full gap-3">
          <div className="flex justify-between items-center py-2">
            <label className="text-sm font-medium">{t("makeProfilePublic")}</label>
            <label className="toggle text-base-content">
              <input
                id="makePublic"
                type="checkbox"
                {...register("public")}
              />
              <svg
                aria-label="disabled"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              <svg
                aria-label="enabled"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
              >
                <g
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="4"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M20 6 9 17l-5-5"></path>
                </g>
              </svg>
            </label>
          </div>

          <label className="label text-sm font-medium">{t("displayName")}</label>
          <input
            type="text"
            className="input w-full"
            placeholder="Display name"
            {...register("display_name")}
          />

          <label className="label text-sm font-medium">{t("description")}</label>
          <textarea
            className="textarea w-full"
            placeholder="Short info about you"
            {...register("about")}
          />

          <button
            type="submit"
            className="btn btn-primary w-full mt-2"
            disabled={uploading || !formState.isDirty}
          >
            {t("ctaSave")}
          </button>
        </fieldset>

        <div className="mt-8 pt-4 border-t border-base-300 text-center">
          <Link
            href="/delete-account"
            className="text-xs text-base-content/30 hover:text-error transition-colors underline-offset-2 hover:underline"
          >
            {t("deleteAccount")}
          </Link>
        </div>
      </form>
    </div>
  );
}
