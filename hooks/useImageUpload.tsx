import { createClient } from "@/utils/supabase/client";
import { useState } from "react";

export function useProductImageUpload() {
  const supabase = createClient();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const uploadProductImage = async (file: File, productId: string) => {
    if (!file) {
      setError("No file provided");
      console.log("No file provided for upload");
      return null;
    }
    try {
      setUploading(true);
      setError(null);

      const fileExt = file.name.split(".").pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `${productId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product_images")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("product_images").getPublicUrl(filePath);

      setImageUrl(publicUrl);
      return publicUrl;
    } catch (err) {
      console.error("Image upload failed:", err);
      setError("Image upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return {
    uploadProductImage,
    uploading,
    error,
    imageUrl,
  };
}
