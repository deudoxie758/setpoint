import { ClipWithPlayer } from "@/lib/types";
import { getEmbedUrl } from "@/lib/embed";

interface Props {
  clip: ClipWithPlayer;
  selected?: boolean;
  onToggleSelected?: () => void;
  readOnly?: boolean;
}

const outcomeBadgeClass: Record<ClipWithPlayer["outcome"], string> = {
  POINT_WON: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  POINT_LOST: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  NO_POINT: "border-slate-400/30 bg-slate-400/10 text-slate-300",
};

export function ClipCard({ clip, selected = false, onToggleSelected, readOnly = false }: Props) {
  const embedUrl = clip.sourceType === "LINK" ? getEmbedUrl(clip.url) : null;

  return (
    <div className="card card-hover flex flex-col gap-3 p-3">
      {!readOnly && (
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-cyan-400"
          />
          Select
        </label>
      )}

      {clip.sourceType === "UPLOAD" ? (
        <video src={clip.url} controls className="aspect-video w-full rounded-lg bg-black" />
      ) : embedUrl ? (
        <iframe src={embedUrl} className="aspect-video w-full rounded-lg" allowFullScreen />
      ) : (
        <a
          href={clip.url}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-video w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-cyan-300 underline"
        >
          Open link ↗
        </a>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-medium text-slate-100">{clip.title}</p>
        <p className="text-sm text-slate-400">
          {clip.player.name}
          {clip.opponent ? ` vs ${clip.opponent}` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="badge border-cyan-400/30 bg-cyan-400/10 text-cyan-300">{clip.skill}</span>
          <span className={`badge ${outcomeBadgeClass[clip.outcome]}`}>{clip.outcome.replace("_", " ")}</span>
        </div>
      </div>
    </div>
  );
}
