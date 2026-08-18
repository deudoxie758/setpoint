"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Clip, ClipWithPlayer, ClipFilters } from "@/lib/types";
import { ClipFormValues } from "@/lib/schemas";

function buildQuery(filters: ClipFilters): string {
  const params = new URLSearchParams();
  if (filters.playerId) params.set("playerId", filters.playerId);
  if (filters.skill) params.set("skill", filters.skill);
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.opponent) params.set("opponent", filters.opponent);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useClips(filters: ClipFilters = {}) {
  return useQuery({
    queryKey: ["clips", filters],
    queryFn: () => apiFetch<{ clips: ClipWithPlayer[] }>(`/clips${buildQuery(filters)}`).then((r) => r.clips),
  });
}

export function useClip(id: string) {
  return useQuery({
    queryKey: ["clips", id],
    queryFn: () => apiFetch<{ clip: ClipWithPlayer }>(`/clips/${id}`).then((r) => r.clip),
    enabled: Boolean(id),
  });
}

export interface CreateClipInput extends ClipFormValues {
  // The server verifies this token (see server/src/lib/aiSuggestionToken.ts)
  // before granting the AI-provenance badge — the client can no longer just
  // assert aiSuggested/aiConfidence/aiRationale directly.
  aiSuggestionToken?: string;
}

export function useCreateClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClipInput) =>
      apiFetch<{ clip: ClipWithPlayer }>("/clips", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      // A new clip changes its player's stats rollup (and any cached single-player
      // query), so invalidate players broadly rather than just the clips list.
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
  });
}

export function useUpdateClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClipFormValues> }) =>
      apiFetch<{ clip: Clip }>(`/clips/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      // Editing a clip's skill/outcome/playerId affects a player's stats rollup —
      // invalidate players broadly since the mutation only knows the clip id, not
      // which player(s) are affected (the playerId may itself have just changed).
      queryClient.invalidateQueries({ queryKey: ["players"] });
    },
  });
}

export function useDeleteClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/clips/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clips"] });
      // Deleting a clip changes its player's stats rollup, and the clip may
      // still be referenced in cached playlist queries.
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}
