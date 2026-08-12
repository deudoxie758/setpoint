"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clipFormSchema, ClipFormValues, SKILLS, OUTCOMES } from "@/lib/schemas";
import { usePlayers } from "@/hooks/usePlayers";
import { useCreateClip } from "@/hooks/useClips";
import { useUpload } from "@/hooks/useUpload";

export default function NewClipPage() {
  const router = useRouter();
  const { data: players } = usePlayers();
  const createClip = useCreateClip();
  const { upload, progress, error: uploadError, uploading } = useUpload();
  const [mode, setMode] = useState<"LINK" | "UPLOAD">("LINK");
  const [file, setFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClipFormValues>({
    resolver: zodResolver(clipFormSchema),
    defaultValues: { sourceType: "LINK" },
  });

  async function onSubmit(values: ClipFormValues) {
    let url = values.url;

    if (mode === "UPLOAD") {
      if (!file) return;
      url = await upload(file);
    }

    createClip.mutate({ ...values, sourceType: mode, url }, { onSuccess: () => router.push("/") });
  }

  function selectMode(next: "LINK" | "UPLOAD") {
    setMode(next);
    setValue("sourceType", next);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Add a clip</h1>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => selectMode("LINK")}
          className={mode === "LINK" ? "font-semibold underline" : ""}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => selectMode("UPLOAD")}
          className={mode === "UPLOAD" ? "font-semibold underline" : ""}
        >
          Upload
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div>
          <input {...register("title")} placeholder="Title" className="w-full rounded border px-2 py-1" />
          {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
        </div>

        {mode === "LINK" ? (
          <div>
            <input {...register("url")} placeholder="https://…" className="w-full rounded border px-2 py-1" />
            {errors.url && <p className="text-sm text-red-600">{errors.url.message}</p>}
          </div>
        ) : (
          <div>
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {uploading && <p>Uploading… {progress}%</p>}
            {uploadError && (
              <p className="text-sm text-red-600">
                {uploadError} —{" "}
                <button type="button" onClick={() => file && upload(file)}>
                  Retry
                </button>
              </p>
            )}
          </div>
        )}

        <select {...register("playerId")} className="rounded border px-2 py-1">
          <option value="">Select player…</option>
          {players?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errors.playerId && <p className="text-sm text-red-600">{errors.playerId.message}</p>}

        <select {...register("skill")} className="rounded border px-2 py-1">
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select {...register("outcome")} className="rounded border px-2 py-1">
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <input {...register("opponent")} placeholder="Opponent (optional)" className="rounded border px-2 py-1" />
        <textarea {...register("notes")} placeholder="Notes (optional)" className="rounded border px-2 py-1" />

        <button
          type="submit"
          disabled={uploading || createClip.isPending}
          className="rounded bg-slate-900 px-3 py-1 text-white"
        >
          Save clip
        </button>
      </form>
    </div>
  );
}
