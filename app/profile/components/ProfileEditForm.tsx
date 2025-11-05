"use client";
import useProfile, { Profile } from "@/hooks/useProfile";
import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import AvatarUploader from "./AvatarUpload";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/providers/ToastProvider";

export function ProfileEditForm({
  onCloseModal,
}: {
  onCloseModal: () => void;
}) {
  const { profile, isLoading, editProfile } = useProfile();
  const [uploading, setUploading] = useState(false);
  const { toastError, toastSuccess } = useToast();
  const t = useTranslations("Profile");

  const { register, handleSubmit, reset } = useForm<Profile>({
    defaultValues: {
      display_name: profile?.display_name || "NOT SET",
      about: profile?.about || "",
    },
  });

  const onSubmit: SubmitHandler<Profile> = async (data) => {
    setUploading(true);
    try {
      await editProfile(data);
      toastSuccess(t("toastProfileUpdated"));
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

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-8">
        <h2 className="text-2xl">{t("editProfile")}</h2>
      </div>
      <div>
        <AvatarUploader profile={profile} />
      </div>
      <div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <fieldset className="fieldset w-xs p-4">
            <label className="label">{t("displayName")}</label>
            <input
              type="text"
              className="input"
              placeholder="Display name"
              {...register("display_name")}
            />

            <label className="label">{t("description")}</label>
            <textarea
              className="textarea"
              placeholder="Short info about you"
              {...register("about")}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading}
            >
              {t("ctaSave")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={uploading}
            >
              {t("ctaClose")}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
