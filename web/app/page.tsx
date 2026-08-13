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
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">Film Room</p>
          <h1 className="text-2xl font-bold text-slate-50">Clip Library</h1>
        </div>
        <Link href="/clips/new" className="btn-primary">
          + Add clip
        </Link>
      </div>

      <FilterBar players={players ?? []} filters={filters} onChange={setFilters} />

      {selectedIds.length > 0 && (
        <div className="card flex items-center gap-3 p-3">
          <span className="text-sm text-slate-300">{selectedIds.length} selected</span>
          <select
            value={targetPlaylistId}
            onChange={(e) => setTargetPlaylistId(e.target.value)}
            aria-label="Target playlist"
            className="field bg-slate-900"
          >
            <option value="">Choose a playlist…</option>
            {playlists?.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addSelectedToPlaylist} disabled={!targetPlaylistId} className="btn-ghost">
            Add to playlist
          </button>
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

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
