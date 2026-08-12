"use client";

import { ClipFilters, Skill, Outcome, Player } from "@/lib/types";
import { SKILLS, OUTCOMES } from "@/lib/schemas";

interface Props {
  players: Player[];
  filters: ClipFilters;
  onChange: (filters: ClipFilters) => void;
}

export function FilterBar({ players, filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        aria-label="Filter by player"
        value={filters.playerId ?? ""}
        onChange={(e) => onChange({ ...filters, playerId: e.target.value || undefined })}
        className="rounded border px-2 py-1"
      >
        <option value="">All players</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by skill"
        value={filters.skill ?? ""}
        onChange={(e) => onChange({ ...filters, skill: (e.target.value || undefined) as Skill | undefined })}
        className="rounded border px-2 py-1"
      >
        <option value="">All skills</option>
        {SKILLS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by outcome"
        value={filters.outcome ?? ""}
        onChange={(e) => onChange({ ...filters, outcome: (e.target.value || undefined) as Outcome | undefined })}
        className="rounded border px-2 py-1"
      >
        <option value="">All outcomes</option>
        {OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <input
        aria-label="Filter by opponent"
        type="text"
        placeholder="Opponent"
        value={filters.opponent ?? ""}
        onChange={(e) => onChange({ ...filters, opponent: e.target.value || undefined })}
        className="rounded border px-2 py-1"
      />
    </div>
  );
}
