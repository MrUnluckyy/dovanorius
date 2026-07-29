import { createClient } from "@/utils/supabase/client";
import { useState } from "react";

// Uploads an event cover image to the public `event-covers` bucket, mirroring
// hooks/useImageUpload.tsx#useProductImageUpload. Cover lives at
// `${eventId}/cover.jpg` (upsert) so re-uploading replaces the previous one.
export function useEventCoverUpload() {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadEventCover = async (
    file: File,
    eventId: string
  ): Promise<string | null> => {
    if (!file) {
      setError("No file provided");
      return null;
    }
    try {
      setUploading(true);
      setError(null);

      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${eventId}/cover.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("event-covers").getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error("Event cover upload failed:", err);
      setError("Event cover upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadEventCover, uploading, error };
}
