"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePlayers, useCreatePlayer, useUpdatePlayer, useDeletePlayer } from "@/hooks/usePlayers";
import { playerFormSchema, PlayerFormValues } from "@/lib/schemas";
import { Player } from "@/lib/types";
import { ApiClientError } from "@/lib/apiClient";

export default function PlayersPage() {
  const { data: players, isLoading } = usePlayers();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlayerFormValues>({ resolver: zodResolver(playerFormSchema) });

  function errorMessage(err: unknown, fallback: string): string {
    return err instanceof ApiClientError ? err.message : fallback;
  }

  function onSubmit(values: PlayerFormValues) {
    setFormError(null);
    // The form always represents the player's full current state, so a blank
    // field means "clear it" — send null explicitly rather than omitting the
    // key, which the backend would otherwise treat as "leave unchanged".
    const data = {
      name: values.name,
      position: values.position ?? null,
      graduationYear: values.graduationYear ?? null,
    };

    if (editingId) {
      updatePlayer.mutate(
        { id: editingId, data },
        {
          onSuccess: () => {
            setEditingId(null);
            reset();
          },
          onError: (err) => setFormError(errorMessage(err, "Failed to save player.")),
        }
      );
    } else {
      createPlayer.mutate(data, {
        onSuccess: () => reset(),
        onError: (err) => setFormError(errorMessage(err, "Failed to add player.")),
      });
    }
  }

  function handleDelete(playerId: string) {
    setDeleteError(null);
    deletePlayer.mutate(playerId, {
      onError: (err) => setDeleteError(errorMessage(err, "Failed to delete player.")),
    });
  }

  function startEdit(player: Player) {
    setEditingId(player.id);
    reset({
      name: player.name,
      position: player.position ?? undefined,
      graduationYear: player.graduationYear ?? undefined,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    reset({ name: "", position: undefined, graduationYear: undefined });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">Roster</p>
        <h1 className="text-2xl font-bold text-slate-50">Players</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-wrap items-start gap-3 p-4">
        <div>
          <input {...register("name")} placeholder="Name" className="field bg-slate-900" />
          {errors.name && <p className="text-sm text-rose-400">{errors.name.message}</p>}
        </div>
        <input {...register("position")} placeholder="Position" className="field bg-slate-900" />
        <input
          {...register("graduationYear")}
          placeholder="Grad year"
          type="number"
          className="field w-28 bg-slate-900"
        />
        <button type="submit" className="btn-primary">
          {editingId ? "Save" : "Add player"}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit} className="btn-ghost">
            Cancel
          </button>
        )}
        {formError && <p className="w-full text-sm text-rose-400">{formError}</p>}
      </form>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {deleteError && <p className="text-sm text-rose-400">{deleteError}</p>}

      <ul className="flex flex-col gap-2">
        {players?.map((player) => (
          <li key={player.id} className="card card-hover flex items-center justify-between p-3">
            <Link href={`/players/${player.id}`} className="text-slate-200 hover:text-cyan-300">
              {player.name}
              {player.position ? <span className="text-slate-400"> — {player.position}</span> : ""}
              {player.graduationYear ? (
                <span className="ml-1 font-mono text-xs text-slate-500">'{String(player.graduationYear).slice(-2)}</span>
              ) : (
                ""
              )}
            </Link>
            <div className="flex gap-4 text-sm">
              <button type="button" onClick={() => startEdit(player)} className="text-cyan-300 hover:text-cyan-200">
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(player.id)}
                className="text-rose-400 hover:text-rose-300"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
