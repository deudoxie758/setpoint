"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clipFormSchema, ClipFormValues } from "@/lib/schemas";
import { SKILLS, OUTCOMES } from "@/lib/schemas";
import { useClip, useUpdateClip } from "@/hooks/useClips";
import { usePlayers } from "@/hooks/usePlayers";
import { ApiClientError } from "@/lib/apiClient";
import { getEmbedUrl } from "@/lib/embed";

export default function ClipDetailPage({ params }: { params: { id: string } }) {
  const clipId = params.id;
  const { data: clip, isLoading, isError, error } = useClip(clipId);
  const { data: players } = usePlayers();
  const updateClip = useUpdateClip();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClipFormValues>({ resolver: zodResolver(clipFormSchema) });

  // Re-sync the form (and the save/error banners) only when we start editing a
  // *different* clip — not on every refetch of the current one. useUpdateClip
  // invalidates this same clip's query on every successful save, so if the form
  // synced reactively off the query result (e.g. via useForm's `values` option),
  // the background refetch that follows a save could silently overwrite whatever
  // the user had already started typing next. Tracking "which clip have we
  // initialized for" in a ref, rather than reacting to the clip object's
  // identity, is what breaks that link.
  const initializedForClipId = useRef<string | null>(null);

  useEffect(() => {
    if (!clip) return;
    if (initializedForClipId.current === clipId) return;
    initializedForClipId.current = clipId;
    setSubmitError(null);
    setSaved(false);
    reset({
      title: clip.title,
      sourceType: clip.sourceType,
      url: clip.url,
      playerId: clip.playerId,
      skill: clip.skill,
      outcome: clip.outcome,
      opponent: clip.opponent ?? undefined,
      matchDate: clip.matchDate ? clip.matchDate.slice(0, 10) : undefined,
      notes: clip.notes ?? undefined,
    });
  }, [clip, clipId, reset]);

  function onSubmit(values: ClipFormValues) {
    setSubmitError(null);
    setSaved(false);
    updateClip.mutate(
      { id: clipId, data: values },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => setSubmitError(err instanceof ApiClientError ? err.message : "Failed to save clip."),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
        <div className="aspect-video w-full animate-pulse rounded-lg bg-white/5" />
        <div className="h-48 w-full animate-pulse rounded-lg bg-white/5" />
      </div>
    );
  }

  if (isError || !clip) {
    return (
      <p className="text-sm text-rose-400">
        {error instanceof ApiClientError ? error.message : "This clip could not be found."}
      </p>
    );
  }

  const embedUrl = clip.sourceType === "LINK" ? getEmbedUrl(clip.url) : null;

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">Clip Detail</p>
        <h1 className="text-2xl font-bold text-slate-50">{clip.title}</h1>
        <p className="text-sm text-slate-400">
          {clip.player.name}
          {clip.opponent ? ` vs ${clip.opponent}` : ""}
        </p>
      </div>

      {clip.sourceType === "UPLOAD" ? (
        <video src={clip.url} controls className="aspect-video w-full rounded-lg bg-black" />
      ) : embedUrl ? (
        <iframe src={embedUrl} className="aspect-video w-full rounded-lg" allowFullScreen />
      ) : (
        <a href={clip.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">
          Open link ↗
        </a>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-3 p-4">
        <div>
          <input {...register("title")} placeholder="Title" className="field w-full bg-slate-900" />
          {errors.title && <p className="text-sm text-rose-400">{errors.title.message}</p>}
        </div>

        {clip.sourceType === "LINK" ? (
          <div>
            <input {...register("url")} placeholder="https://…" className="field w-full bg-slate-900" />
            {errors.url && <p className="text-sm text-rose-400">{errors.url.message}</p>}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Uploaded clips can&rsquo;t be re-uploaded here — delete and re-add to replace the file.
          </p>
        )}

        <select {...register("playerId")} className="field bg-slate-900">
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
        <div>
          <label className="mb-1 block text-xs text-slate-500">Match date (optional)</label>
          <input {...register("matchDate")} type="date" className="field bg-slate-900" />
        </div>
        <textarea {...register("notes")} placeholder="Notes (optional)" className="field bg-slate-900" />

        {submitError && <p className="text-sm text-rose-400">{submitError}</p>}
        {saved && !updateClip.isPending && <p className="text-sm text-emerald-400">Saved.</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={updateClip.isPending} className="btn-primary">
            Save changes
          </button>
          <Link href="/" className="btn-ghost">
            Back to library
          </Link>
        </div>
      </form>
    </div>
  );
}
