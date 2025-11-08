"use client";

import { createClient } from "@/utils/supabase/client";
import { useState } from "react";
import { UserAvatar } from "./UserAvatar";
import { LuPen } from "react-icons/lu";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/providers/ToastProvider";
import { useRouter } from "next/navigation";

export default function AvatarUploader({
  profile,
}: {
  profile?: { avatar_url?: string | null };
}) {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const t = useTranslations("Profile");
  const { toastError } = useToast();
  const router = useRouter();

  const getPreviewUrl = () => (file ? URL.createObjectURL(file) : undefined);

  async function onFileChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;

    if (!file.type.startsWith("image/"))
      return toastError("Please choose an image.");
    if (file.size > 2 * 1024 * 1024) return toastError("Max size 2 MB.");

    setUploading(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      if (!user) throw new Error("Not authenticated");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          upsert: true,
          // reduce caching of the object itself
          cacheControl: "0",
          contentType: file.type,
        });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("Could not get public URL");

      // cache-bust the URL we store in DB so <img> fetches the new bytes
      const bustedUrl = `${pub.publicUrl}?v=${Date.now()}`;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: bustedUrl })
        .eq("id", user.id);
      if (profErr) throw profErr;

      // Clear local file & refresh server props so UserAvatar receives the new url
      router.refresh();
    } catch (err) {
      console.error(err);
      toastError(t("errorUploadingAvatar"));
    } finally {
      setUploading(false);
    }
  }

  if (!profile) return <p>Loading...</p>;
  return (
    <div className="flex flex-col items-center gap-4 mb-8 relative">
      <label htmlFor="avatarUpload" className="relative cursor-pointer">
        {file ? (
          <div className="avatar">
            <div className="w-30 rounded-full">
              <img src={getPreviewUrl()} alt="User avatar preview" />
            </div>
          </div>
        ) : (
          <UserAvatar size="30" avatarUrl={profile.avatar_url ?? undefined} />
        )}
        <div className="absolute top-1 right-1 h-8 w-8 rounded-full bg-base-200 flex justify-center items-center">
          <LuPen />
        </div>
      </label>

      <form onSubmit={onFileChange}>
        <input
          id="avatarUpload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <button
            className="btn btn-primary"
            type="submit"
            disabled={uploading}
          >
            {uploading ? t("saving") : t("ctaSave")}
          </button>
        )}
      </form>
    </div>
  );
}
