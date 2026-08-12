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
      <h1 className="text-xl font-semibold">Playlists</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-start gap-3">
        <div>
          <input {...register("name")} placeholder="Playlist name" className="rounded border px-2 py-1" />
          {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <input
          {...register("description")}
          placeholder="Description (optional)"
          className="rounded border px-2 py-1"
        />
        <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-white">
          Create playlist
        </button>
      </form>

      {isLoading && <p>Loading…</p>}

      <ul className="flex flex-col gap-2">
        {playlists?.map((playlist) => (
          <li key={playlist.id} className="rounded border bg-white p-3">
            <Link href={`/playlists/${playlist.id}`} className="font-medium text-blue-600 underline">
              {playlist.name}
            </Link>
            {playlist.description && <p className="text-sm text-slate-600">{playlist.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
