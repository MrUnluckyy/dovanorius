"use client";

import { createClient } from "@/utils/supabase/client";
import { useState } from "react";
import { UserAvatar } from "./UserAvatar";

export default function AvatarUploader({
  profile,
}: {
  profile?: { avatar_url?: string | null };
}) {
  const supabase = createClient();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const getPreviewUrl = () => {
    if (file) {
      return URL.createObjectURL(file);
    }
  };

  async function onFileChange() {
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert("Max size 2 MB.");
      return;
    }

    setUploading(true);
    try {
      // Who is the user?
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create a stable path: avatars/<userId>/avatar.<ext>
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

      console.log("ext", ext);
      const path = `${user.id}/avatar.${ext}`;

      // Optional: remove previous avatar to keep only one file
      // await supabase.storage.from("avatars").remove([path]);

      // Upload (upsert to overwrite)
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type,
        });
      if (upErr) throw upErr;

      // Get public URL
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error("Could not get public URL");

      // Save to profile
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("id", user.id);
      if (profErr) throw profErr;
    } catch (err) {
      alert(err ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!profile) return <p>Loading...</p>;
  return (
    <div className="flex items-center gap-4 mb-8">
      <label htmlFor="avatarUpload">
        {file ? (
          <div className="avatar">
            <div className="w-24 rounded-full">
              <img src={getPreviewUrl()} alt="User avatar preview" />
            </div>
          </div>
        ) : (
          <UserAvatar avatarUrl={profile?.avatar_url} />
        )}
      </label>

      <form onSubmit={onFileChange}>
        <input
          id="avatarUpload"
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
        />
        {file && (
          <button className="btn" type="submit" disabled={uploading}>
            Save
          </button>
        )}
      </form>
    </div>
  );
}
