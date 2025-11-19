"use client";
import useProfile, { Profile } from "@/hooks/useProfile";
import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import AvatarUploader from "./AvatarUpload";
import { useTranslations } from "next-intl";
import { toast } from "react-hot-toast";
import { useConfirm } from "@/components/ConfirmDialogProvider";
import { deleteUserAction } from "@/app/actions/user/delete";
import { useRouter } from "next/navigation";

export function ProfileEditForm({
  onCloseModal,
}: {
  onCloseModal: () => void;
}) {
  const { profile, editProfile } = useProfile();
  const [uploading, setUploading] = useState(false);
  const t = useTranslations("Profile");
  const confirm = useConfirm();
  const router = useRouter();

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

  const handleDeleteUser = async () => {
    const confirmed = await confirm({
      title: t("confirmDeleteAccountTitle"),
      message: t.rich("confirmDeleteAccountMessage", {
        format: (chunks) => <b>{chunks}</b>,
      }),
      confirmText: t("deleteAccount"),
      cancelText: t("ctaCancel"),
    });

    if (!confirmed || !profile?.id) return;

    try {
      const res = await deleteUserAction(profile.id);
      if (res.success) {
        router.push("/");
      }
    } catch (error) {
      toast.error(t("toastAccountDeleteError"));
    }
  };

  useEffect(() => {
    if (profile) {
      reset(profile);
    }
  }, [profile, reset]);

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
            <div className="flex justify-between mb-4">
              <label className="text-lg">{t("makeProfilePublic")}</label>
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
              type="button"
              className="btn btn-error"
              onClick={handleDeleteUser}
            >
              {t("deleteAccount")}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !formState.isDirty}
            >
              {t("ctaSave")}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
