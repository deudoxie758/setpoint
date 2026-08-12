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
      <h1 className="text-xl font-semibold">Players</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-start gap-3">
        <div>
          <input {...register("name")} placeholder="Name" className="rounded border px-2 py-1" />
          {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <input {...register("position")} placeholder="Position" className="rounded border px-2 py-1" />
        <input
          {...register("graduationYear")}
          placeholder="Grad year"
          type="number"
          className="rounded border px-2 py-1"
        />
        <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-white">
          {editingId ? "Save" : "Add player"}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit}>
            Cancel
          </button>
        )}
      </form>

      {isLoading && <p>Loading…</p>}

      <ul className="flex flex-col gap-2">
        {players?.map((player) => (
          <li key={player.id} className="flex items-center justify-between rounded border bg-white p-3">
            <span>
              {player.name}
              {player.position ? ` — ${player.position}` : ""}
              {player.graduationYear ? ` (${player.graduationYear})` : ""}
            </span>
            <div className="flex gap-3 text-sm">
              <button type="button" onClick={() => startEdit(player)}>
                Edit
              </button>
              <button type="button" onClick={() => deletePlayer.mutate(player.id)} className="text-red-600">
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
