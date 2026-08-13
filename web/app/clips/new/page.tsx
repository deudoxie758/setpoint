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
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">New Entry</p>
        <h1 className="text-2xl font-bold text-slate-50">Add a clip</h1>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => selectMode("LINK")}
          className={mode === "LINK" ? "btn-primary" : "btn-ghost"}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => selectMode("UPLOAD")}
          className={mode === "UPLOAD" ? "btn-primary" : "btn-ghost"}
        >
          Upload
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-3 p-4">
        <div>
          <input {...register("title")} placeholder="Title" className="field w-full bg-slate-900" />
          {errors.title && <p className="text-sm text-rose-400">{errors.title.message}</p>}
        </div>

        {mode === "LINK" ? (
          <div>
            <input {...register("url")} placeholder="https://…" className="field w-full bg-slate-900" />
            {errors.url && <p className="text-sm text-rose-400">{errors.url.message}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/10 file:px-3 file:py-1.5 file:text-cyan-300"
            />
            {uploading && <p className="font-mono text-xs text-cyan-300">Uploading… {progress}%</p>}
            {uploadError && (
              <p className="text-sm text-rose-400">
                {uploadError} —{" "}
                <button type="button" onClick={() => file && upload(file)} className="underline">
                  Retry
                </button>
              </p>
            )}
          </div>
        )}

        <select {...register("playerId")} className="field bg-slate-900">
          <option value="">Select player…</option>
          {players?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errors.playerId && <p className="text-sm text-rose-400">{errors.playerId.message}</p>}

        <select {...register("skill")} className="field bg-slate-900">
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select {...register("outcome")} className="field bg-slate-900">
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <input {...register("opponent")} placeholder="Opponent (optional)" className="field bg-slate-900" />
        <textarea {...register("notes")} placeholder="Notes (optional)" className="field bg-slate-900" />

        <button type="submit" disabled={uploading || createClip.isPending} className="btn-primary">
          Save clip
        </button>
      </form>
    </div>
  );
}
