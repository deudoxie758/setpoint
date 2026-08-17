"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clipFormSchema, ClipFormValues, SKILLS, OUTCOMES } from "@/lib/schemas";
import { Skill } from "@/lib/types";
import { usePlayers } from "@/hooks/usePlayers";
import { useCreateClip } from "@/hooks/useClips";
import { useUpload } from "@/hooks/useUpload";
import { ApiClientError } from "@/lib/apiClient";
import { captureFrames } from "@/lib/captureFrames";
import { useAiStatus, useSuggestTags } from "@/hooks/useAiTagging";

export default function NewClipPage() {
  const router = useRouter();
  const { data: players } = usePlayers();
  const createClip = useCreateClip();
  const { upload, progress, error: uploadError, uploading } = useUpload();
  const [mode, setMode] = useState<"LINK" | "UPLOAD">("LINK");
  const [file, setFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: aiAvailable } = useAiStatus();
  const suggestTags = useSuggestTags();
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{
    confidence: number;
    rationale: string;
    skill: Skill;
    token: string;
  } | null>(null);
  const [jerseyColor, setJerseyColor] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClipFormValues>({
    resolver: zodResolver(clipFormSchema),
    defaultValues: { sourceType: "LINK" },
  });

  const selectedPlayerId = watch("playerId");
  const selectedPlayerPosition = players?.find((p) => p.id === selectedPlayerId)?.position ?? undefined;

  function resetAiState() {
    setAiSuggestion(null);
    setAiError(null);
  }

  async function onSubmit(values: ClipFormValues) {
    setSubmitError(null);
    let url = values.url;

    if (mode === "UPLOAD") {
      if (!file) return;
      try {
        url = await upload(file);
      } catch {
        return;
      }
    }

    // The AI-provenance badge is granted server-side, not decided here — the
    // server verifies this token proves it really came from a real
    // /ai/suggest-tags call for this exact player/skill/outcome (see
    // aiSuggestionToken.ts). If the token is missing, stale, or no longer
    // matches what's being submitted, the server just saves a normal manual tag.
    createClip.mutate(
      {
        ...values,
        sourceType: mode,
        url,
        aiSuggestionToken: aiSuggestion?.token,
      },
      {
        onSuccess: () => router.push("/"),
        onError: (err) => setSubmitError(err instanceof ApiClientError ? err.message : "Failed to save clip."),
      }
    );
  }

  function selectMode(next: "LINK" | "UPLOAD") {
    setMode(next);
    setValue("sourceType", next);
  }

  async function handleSuggestTags() {
    if (!file || !jerseyColor.trim() || !selectedPlayerId) return;
    setAiError(null);
    setAiSuggestion(null);
    try {
      const frames = await captureFrames(file);
      const suggestion = await suggestTags.mutateAsync({
        frames,
        jerseyColor: jerseyColor.trim(),
        jerseyNumber: jerseyNumber.trim() || undefined,
        position: selectedPlayerPosition,
        playerId: selectedPlayerId,
      });
      setValue("skill", suggestion.skill);
      setValue("outcome", suggestion.outcome);
      setAiSuggestion({
        confidence: suggestion.confidence,
        rationale: suggestion.rationale,
        skill: suggestion.skill,
        token: suggestion.token,
      });
    } catch {
      setAiError("Couldn't generate a suggestion. You can still tag this clip manually.");
    }
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
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                resetAiState();
              }}
              className="text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/10 file:px-3 file:py-1.5 file:text-cyan-300"
            />
            {uploading && <p className="font-mono text-xs text-cyan-300">Uploading… {progress}%</p>}
            {uploadError && (
              <p className="text-sm text-rose-400">
                {uploadError} —{" "}
                <button type="button" onClick={() => file && upload(file).catch(() => {})} className="underline">
                  Retry
                </button>
              </p>
            )}
            {file && aiAvailable && (
              <div className="flex flex-col gap-2 rounded-lg border border-white/10 p-3">
                <div className="flex gap-2">
                  <input
                    value={jerseyColor}
                    onChange={(e) => setJerseyColor(e.target.value)}
                    placeholder="Jersey color (required for AI)"
                    className="field flex-1 bg-slate-900 text-sm"
                  />
                  <input
                    value={jerseyNumber}
                    onChange={(e) => setJerseyNumber(e.target.value)}
                    placeholder="Number (optional)"
                    className="field w-32 bg-slate-900 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSuggestTags}
                  disabled={suggestTags.isPending || !jerseyColor.trim() || !selectedPlayerId}
                  className="btn-ghost self-start text-sm"
                >
                  {suggestTags.isPending ? "Analyzing…" : "Suggest tags with AI"}
                </button>
                {!jerseyColor.trim() && (
                  <p className="text-xs text-slate-500">Enter the jersey color above to enable AI suggestions.</p>
                )}
                {jerseyColor.trim() && !selectedPlayerId && (
                  <p className="text-xs text-slate-500">Select a player below to enable AI suggestions.</p>
                )}
              </div>
            )}
            {aiSuggestion && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-slate-400">
                  AI suggested ({Math.round(aiSuggestion.confidence * 100)}% confidence) — please double-check.{" "}
                  {aiSuggestion.rationale}
                </p>
                {(aiSuggestion.skill === "SPIKE" || aiSuggestion.skill === "BLOCK") && (
                  <p className="text-xs text-amber-400">
                    Spikes and blocks are the hardest for the AI to tell apart — double-check this one closely.
                  </p>
                )}
              </div>
            )}
            {aiError && <p className="text-xs text-rose-400">{aiError}</p>}
          </div>
        )}

        <select {...register("playerId", { onChange: resetAiState })} className="field bg-slate-900">
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
        <div>
          <label className="mb-1 block text-xs text-slate-500">Match date (optional)</label>
          <input {...register("matchDate")} type="date" className="field bg-slate-900" />
        </div>
        <textarea {...register("notes")} placeholder="Notes (optional)" className="field bg-slate-900" />

        {submitError && <p className="text-sm text-rose-400">{submitError}</p>}

        <button type="submit" disabled={uploading || createClip.isPending} className="btn-primary">
          Save clip
        </button>
      </form>
    </div>
  );
}
