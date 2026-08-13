"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";

interface SignedUpload {
  uploadUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}

export function useUpload() {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File): Promise<string> {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const signed = await apiFetch<SignedUpload>("/uploads/sign", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name }),
      });

      await putWithProgress(signed.uploadUrl, file, setProgress);

      return signed.publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      throw err;
    } finally {
      setUploading(false);
    }
  }

  return { upload, progress, error, uploading };
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}
