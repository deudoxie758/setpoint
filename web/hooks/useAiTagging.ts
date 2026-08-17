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

export interface SuggestTagsInput {
  frames: string[];
  jerseyColor: string;
  jerseyNumber?: string;
}

export function useSuggestTags() {
  return useMutation({
    mutationFn: (input: SuggestTagsInput) =>
      apiFetch<TagSuggestion>("/ai/suggest-tags", { method: "POST", body: JSON.stringify(input) }),
  });
}
