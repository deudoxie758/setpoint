"use client";

import Link from "next/link";
import { usePlayers, usePlayerStats } from "@/hooks/usePlayers";

function StatBar({ label, pct, colorClass }: { label: string; pct: number | null; colorClass: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-mono">{pct === null ? "—" : `${pct}%`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  );
}

export default function PlayerDetailPage({ params }: { params: { id: string } }) {
  const playerId = params.id;
  const { data: players, isLoading: playersLoading } = usePlayers();
  const { data: stats, isLoading: statsLoading, isError } = usePlayerStats(playerId);

  const player = players?.find((p) => p.id === playerId);
  const isLoading = playersLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <div className="h-6 w-40 animate-pulse rounded bg-white/5" />
        <div className="h-32 w-full animate-pulse rounded-lg bg-white/5" />
      </div>
    );
  }

  if (isError || !player || !stats) {
    return <p className="text-sm text-rose-400">This player could not be found.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">Player</p>
        <h1 className="text-2xl font-bold text-slate-50">{player.name}</h1>
        <p className="text-sm text-slate-400">
          {player.position ?? "No position set"}
          {player.graduationYear ? ` — Class of ${player.graduationYear}` : ""}
        </p>
      </div>

      <div className="card flex flex-col gap-4 p-4">
        <h2 className="font-medium text-slate-200">Season overview</h2>
        {stats.totalClips === 0 ? (
          <p className="text-sm text-slate-500">
            No clips tagged for {player.name} yet.{" "}
            <Link href="/clips/new" className="text-cyan-300 hover:text-cyan-200">
              Add one
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">{stats.totalClips} clips logged</p>
            <StatBar label="Point-won rate" pct={stats.pointWonPct} colorClass="bg-emerald-400" />
            <StatBar label="Point-lost rate" pct={stats.pointLostPct} colorClass="bg-rose-400" />
            {stats.attackEfficiency !== null && (
              <p className="text-sm text-slate-300">
                Attack efficiency (spikes):{" "}
                <span className="font-mono text-cyan-300">{stats.attackEfficiency.toFixed(3)}</span>
              </p>
            )}
          </>
        )}
      </div>

      {stats.bySkill.length > 0 && (
        <div className="card flex flex-col gap-4 p-4">
          <h2 className="font-medium text-slate-200">By skill</h2>
          {stats.bySkill.map((s) => (
            <div key={s.skill} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono">{s.skill}</span>
                <span>{s.count} clips</span>
              </div>
              <StatBar label="Point-won rate" pct={s.pointWonPct} colorClass="bg-cyan-400" />
            </div>
          ))}
        </div>
      )}

      <Link href="/players" className="btn-ghost self-start">
        Back to players
      </Link>
    </div>
  );
}
