"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Skill, Outcome } from "@/lib/types";

export interface TagSuggestion {
  skill: Skill;
  outcome: Outcome;
  confidence: number;
  rationale: string;
  // Signed server-side proof this suggestion really came from a real
  // /ai/suggest-tags call — pass it back verbatim when saving the clip so
  // the server can verify (and not just trust) the AI provenance badge.
  token: string;
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
  position?: string;
  playerId: string;
}

export function useSuggestTags() {
  return useMutation({
    mutationFn: (input: SuggestTagsInput) =>
      apiFetch<TagSuggestion>("/ai/suggest-tags", { method: "POST", body: JSON.stringify(input) }),
  });
}
