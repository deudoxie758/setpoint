"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Playlist, PlaylistWithClips } from "@/lib/types";
import { PlaylistFormValues } from "@/lib/schemas";

export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: () => apiFetch<{ playlists: Playlist[] }>("/playlists").then((r) => r.playlists),
  });
}

export function usePlaylist(id: string) {
  return useQuery({
    queryKey: ["playlists", id],
    queryFn: () => apiFetch<{ playlist: PlaylistWithClips }>(`/playlists/${id}`).then((r) => r.playlist),
    enabled: Boolean(id),
  });
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlaylistFormValues) =>
      apiFetch<{ playlist: Playlist }>("/playlists", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useAddClipsToPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, clipIds }: { playlistId: string; clipIds: string[] }) =>
      apiFetch<{ playlist: PlaylistWithClips }>(`/playlists/${playlistId}/clips`, {
        method: "POST",
        body: JSON.stringify({ clipIds }),
      }),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["playlists", variables.playlistId] }),
  });
}

export function useReorderPlaylistClips() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, clipIds }: { playlistId: string; clipIds: string[] }) =>
      apiFetch<{ playlist: PlaylistWithClips }>(`/playlists/${playlistId}/clips/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ clipIds }),
      }),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["playlists", variables.playlistId] }),
  });
}

export function useRemovePlaylistClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, clipId }: { playlistId: string; clipId: string }) =>
      apiFetch<void>(`/playlists/${playlistId}/clips/${clipId}`, { method: "DELETE" }),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["playlists", variables.playlistId] }),
  });
}
