"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Player, PlayerStats } from "@/lib/types";

interface PlayerPayload {
  name: string;
  position?: string | null;
  graduationYear?: number | null;
}

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: () => apiFetch<{ players: Player[] }>("/players").then((r) => r.players),
  });
}

export function usePlayer(id: string) {
  return useQuery({
    queryKey: ["players", id],
    queryFn: () => apiFetch<{ player: Player }>(`/players/${id}`).then((r) => r.player),
    enabled: Boolean(id),
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlayerPayload) =>
      apiFetch<{ player: Player }>("/players", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

type PlayerUpdateData = Partial<PlayerPayload>;

export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PlayerUpdateData }) =>
      apiFetch<{ player: Player }>(`/players/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function usePlayerStats(id: string) {
  return useQuery({
    queryKey: ["players", id, "stats"],
    queryFn: () => apiFetch<{ stats: PlayerStats }>(`/players/${id}/stats`).then((r) => r.stats),
    enabled: Boolean(id),
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/players/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}
