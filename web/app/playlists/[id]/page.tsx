"use client";

import { useState } from "react";
import {
  usePlaylist,
  useReorderPlaylistClips,
  useRemovePlaylistClip,
  useAddClipsToPlaylist,
} from "@/hooks/usePlaylists";
import { useClips } from "@/hooks/useClips";
import { usePlayers } from "@/hooks/usePlayers";
import { FilterBar } from "@/components/FilterBar";
import { PlaylistClipList } from "@/components/PlaylistClipList";
import { ClipFilters } from "@/lib/types";
import { ApiClientError } from "@/lib/apiClient";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function PlaylistBuilderPage({ params }: { params: { id: string } }) {
  const playlistId = params.id;

  const { data: playlist, isLoading, isError, error } = usePlaylist(playlistId);
  const reorder = useReorderPlaylistClips();
  const removeClip = useRemovePlaylistClip();
  const addClips = useAddClipsToPlaylist();
  const [reorderError, setReorderError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ClipFilters>({});
  const { data: players } = usePlayers();
  const { data: filteredClips } = useClips(filters);

  function addAllMatchingFilter() {
    if (!filteredClips || filteredClips.length === 0) return;
    addClips.mutate({ playlistId, clipIds: filteredClips.map((c) => c.id) });
  }

  function handleReorder(clipIds: string[]) {
    setReorderError(null);
    reorder.mutate(
      { playlistId, clipIds },
      {
        onError: (err) =>
          setReorderError(err instanceof ApiClientError ? err.message : "Failed to reorder clips."),
      }
    );
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  if (isError || !playlist) {
    return (
      <p className="text-sm text-rose-400">
        {error instanceof ApiClientError ? error.message : "This playlist could not be found."}
      </p>
    );
  }

  const shareUrl = `${APP_URL}/share/${playlist.shareToken}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">Reel Builder</p>
        <h1 className="text-2xl font-bold text-slate-50">{playlist.name}</h1>
      </div>

      <div className="card flex items-center gap-2 p-3">
        <span className="text-sm text-slate-400">Share link:</span>
        <code className="flex-1 truncate font-mono text-sm text-cyan-300">{shareUrl}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)} className="btn-ghost">
          Copy
        </button>
      </div>

      {reorderError && <p className="text-sm text-rose-400">{reorderError}</p>}

      <PlaylistClipList
        clips={playlist.clips}
        onReorder={handleReorder}
        onRemove={(clipId) => removeClip.mutate({ playlistId, clipId })}
      />

      <div className="card flex flex-col gap-3 p-4">
        <h2 className="font-medium text-slate-200">Add clips matching a filter</h2>
        <FilterBar players={players ?? []} filters={filters} onChange={setFilters} />
        <button type="button" onClick={addAllMatchingFilter} disabled={!filteredClips?.length} className="btn-ghost">
          Add {filteredClips?.length ?? 0} matching clips
        </button>
      </div>
    </div>
  );
}
