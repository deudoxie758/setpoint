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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function PlaylistBuilderPage({ params }: { params: { id: string } }) {
  const playlistId = params.id;

  const { data: playlist, isLoading } = usePlaylist(playlistId);
  const reorder = useReorderPlaylistClips();
  const removeClip = useRemovePlaylistClip();
  const addClips = useAddClipsToPlaylist();

  const [filters, setFilters] = useState<ClipFilters>({});
  const { data: players } = usePlayers();
  const { data: filteredClips } = useClips(filters);

  function addAllMatchingFilter() {
    if (!filteredClips || filteredClips.length === 0) return;
    addClips.mutate({ playlistId, clipIds: filteredClips.map((c) => c.id) });
  }

  if (isLoading || !playlist) return <p>Loading…</p>;

  const shareUrl = `${APP_URL}/share/${playlist.shareToken}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{playlist.name}</h1>

      <div className="flex items-center gap-2 rounded border bg-white p-3">
        <span className="text-sm text-slate-600">Share link:</span>
        <code className="text-sm">{shareUrl}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>
          Copy
        </button>
      </div>

      <PlaylistClipList
        clips={playlist.clips}
        onReorder={(clipIds) => reorder.mutate({ playlistId, clipIds })}
        onRemove={(clipId) => removeClip.mutate({ playlistId, clipId })}
      />

      <div className="flex flex-col gap-3 rounded border bg-white p-3">
        <h2 className="font-medium">Add clips matching a filter</h2>
        <FilterBar players={players ?? []} filters={filters} onChange={setFilters} />
        <button type="button" onClick={addAllMatchingFilter} disabled={!filteredClips?.length}>
          Add {filteredClips?.length ?? 0} matching clips
        </button>
      </div>
    </div>
  );
}
