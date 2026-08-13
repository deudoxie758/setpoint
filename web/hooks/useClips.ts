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

export function useCreateClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClipFormValues) =>
      apiFetch<{ clip: ClipWithPlayer }>("/clips", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clips"] }),
  });
}

export function useUpdateClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClipFormValues> }) =>
      apiFetch<{ clip: Clip }>(`/clips/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clips"] }),
  });
}
