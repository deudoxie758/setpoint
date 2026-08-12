"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useClips } from "@/hooks/useClips";
import { usePlayers } from "@/hooks/usePlayers";
import { usePlaylists, useAddClipsToPlaylist } from "@/hooks/usePlaylists";
import { FilterBar } from "@/components/FilterBar";
import { ClipCard } from "@/components/ClipCard";
import { ClipFilters } from "@/lib/types";

export default function LibraryPage() {
  const [filters, setFilters] = useState<ClipFilters>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetPlaylistId, setTargetPlaylistId] = useState("");

  const { data: players } = usePlayers();
  const { data: clips, isLoading } = useClips(filters);
  const { data: playlists } = usePlaylists();
  const addClips = useAddClipsToPlaylist();

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function toggleSelected(clipId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  }

  function addSelectedToPlaylist() {
    if (!targetPlaylistId || selectedIds.length === 0) return;
    addClips.mutate(
      { playlistId: targetPlaylistId, clipIds: selectedIds },
      { onSuccess: () => setSelected(new Set()) }
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clip Library</h1>
        <Link href="/clips/new" className="rounded bg-slate-900 px-3 py-1 text-white">
          Add clip
        </Link>
      </div>

      <FilterBar players={players ?? []} filters={filters} onChange={setFilters} />

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded border bg-white p-3">
          <span>{selectedIds.length} selected</span>
          <select
            value={targetPlaylistId}
            onChange={(e) => setTargetPlaylistId(e.target.value)}
            aria-label="Target playlist"
            className="rounded border px-2 py-1"
          >
            <option value="">Choose a playlist…</option>
            {playlists?.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addSelectedToPlaylist} disabled={!targetPlaylistId}>
            Add to playlist
          </button>
        </div>
      )}

      {isLoading && <p>Loading…</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clips?.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            selected={selected.has(clip.id)}
            onToggleSelected={() => toggleSelected(clip.id)}
          />
        ))}
      </div>
    </div>
  );
}
