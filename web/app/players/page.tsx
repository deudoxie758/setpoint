"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePlayers, useCreatePlayer, useUpdatePlayer, useDeletePlayer } from "@/hooks/usePlayers";
import { playerFormSchema, PlayerFormValues } from "@/lib/schemas";
import { Player } from "@/lib/types";

export default function PlayersPage() {
  const { data: players, isLoading } = usePlayers();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlayerFormValues>({ resolver: zodResolver(playerFormSchema) });

  function onSubmit(values: PlayerFormValues) {
    if (editingId) {
      updatePlayer.mutate(
        { id: editingId, data: values },
        {
          onSuccess: () => {
            setEditingId(null);
            reset();
          },
        }
      );
    } else {
      createPlayer.mutate(values, { onSuccess: () => reset() });
    }
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
      </form>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <ul className="flex flex-col gap-2">
        {players?.map((player) => (
          <li key={player.id} className="card card-hover flex items-center justify-between p-3">
            <span className="text-slate-200">
              {player.name}
              {player.position ? <span className="text-slate-400"> — {player.position}</span> : ""}
              {player.graduationYear ? (
                <span className="ml-1 font-mono text-xs text-slate-500">'{String(player.graduationYear).slice(-2)}</span>
              ) : (
                ""
              )}
            </span>
            <div className="flex gap-4 text-sm">
              <button type="button" onClick={() => startEdit(player)} className="text-cyan-300 hover:text-cyan-200">
                Edit
              </button>
              <button
                type="button"
                onClick={() => deletePlayer.mutate(player.id)}
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
