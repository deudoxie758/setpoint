"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Skill, Outcome } from "@/lib/types";

export interface TagSuggestion {
  skill: Skill;
  outcome: Outcome;
  confidence: number;
  rationale: string;
}

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: () => apiFetch<{ available: boolean }>("/ai/status").then((r) => r.available),
  });
}

export function useSuggestTags() {
  return useMutation({
    mutationFn: (frames: string[]) =>
      apiFetch<TagSuggestion>("/ai/suggest-tags", { method: "POST", body: JSON.stringify({ frames }) }),
  });
}
