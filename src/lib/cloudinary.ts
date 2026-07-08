export async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
  const preset = import.meta.env.VITE_CLOUDINARY_PRESET || "";

  if (!cloudName || !preset) {
    throw new Error(
      "Cloudinary credentials (VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_PRESET) are not configured in environment variables.",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", preset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = (await res.json()) as { error?: { message?: string } };
    throw new Error(errorData.error?.message || "Failed to upload image to Cloudinary.");
  }

  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}
