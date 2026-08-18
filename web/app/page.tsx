"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useClips, useDeleteClip } from "@/hooks/useClips";
import { usePlayers } from "@/hooks/usePlayers";
import { usePlaylists, useAddClipsToPlaylist } from "@/hooks/usePlaylists";
import { FilterBar } from "@/components/FilterBar";
import { ClipCard } from "@/components/ClipCard";
import { CardGridSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ClipFilters } from "@/lib/types";
import { hasActiveFilters } from "@/lib/filters";

export default function LibraryPage() {
  const [filters, setFilters] = useState<ClipFilters>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetPlaylistId, setTargetPlaylistId] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: players } = usePlayers();
  const { data: clips, isLoading } = useClips(filters);
  const { data: playlists } = usePlaylists();
  const addClips = useAddClipsToPlaylist();
  const deleteClip = useDeleteClip();

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

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    setDeleteError(null);
    try {
      await Promise.all(selectedIds.map((id) => deleteClip.mutateAsync(id)));
      setSelected(new Set());
    } catch {
      setDeleteError("Some clips could not be deleted.");
    }
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
          <button
            type="button"
            onClick={deleteSelected}
            disabled={deleteClip.isPending}
            className="ml-auto text-sm text-rose-400 hover:text-rose-300"
          >
            Delete selected
          </button>
        </div>
      )}

      {deleteError && <p className="text-sm text-rose-400">{deleteError}</p>}

      {isLoading && <CardGridSkeleton />}

      {!isLoading && clips?.length === 0 && (
        <EmptyState
          title={hasActiveFilters(filters) ? "No clips match these filters" : "No clips yet"}
          description={
            hasActiveFilters(filters)
              ? "Try clearing a filter to see more clips."
              : "Add your first highlight to start building the library."
          }
          actionHref={hasActiveFilters(filters) ? undefined : "/clips/new"}
          actionLabel={hasActiveFilters(filters) ? undefined : "Add clip"}
        />
      )}

      {!isLoading && clips && clips.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              selected={selected.has(clip.id)}
              onToggleSelected={() => toggleSelected(clip.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
