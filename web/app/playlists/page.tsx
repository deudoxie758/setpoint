"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePlaylists, useCreatePlaylist } from "@/hooks/usePlaylists";
import { playlistFormSchema, PlaylistFormValues } from "@/lib/schemas";

export default function PlaylistsPage() {
  const { data: playlists, isLoading } = usePlaylists();
  const createPlaylist = useCreatePlaylist();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlaylistFormValues>({ resolver: zodResolver(playlistFormSchema) });

  function onSubmit(values: PlaylistFormValues) {
    createPlaylist.mutate(values, { onSuccess: () => reset() });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">Reels</p>
        <h1 className="text-2xl font-bold text-slate-50">Playlists</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-wrap items-start gap-3 p-4">
        <div>
          <input {...register("name")} placeholder="Playlist name" className="field bg-slate-900" />
          {errors.name && <p className="text-sm text-rose-400">{errors.name.message}</p>}
        </div>
        <input {...register("description")} placeholder="Description (optional)" className="field bg-slate-900" />
        <button type="submit" className="btn-primary">
          Create playlist
        </button>
      </form>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <ul className="flex flex-col gap-2">
        {playlists?.map((playlist) => (
          <li key={playlist.id} className="card card-hover p-3">
            <Link href={`/playlists/${playlist.id}`} className="font-medium text-cyan-300 hover:text-cyan-200">
              {playlist.name}
            </Link>
            {playlist.description && <p className="text-sm text-slate-400">{playlist.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
