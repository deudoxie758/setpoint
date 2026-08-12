import { ClipWithPlayer } from "@/lib/types";
import { getEmbedUrl } from "@/lib/embed";

interface Props {
  clip: ClipWithPlayer;
  selected?: boolean;
  onToggleSelected?: () => void;
  readOnly?: boolean;
}

export function ClipCard({ clip, selected = false, onToggleSelected, readOnly = false }: Props) {
  const embedUrl = clip.sourceType === "LINK" ? getEmbedUrl(clip.url) : null;

  return (
    <div className="flex flex-col gap-2 rounded border bg-white p-3">
      {!readOnly && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected} onChange={onToggleSelected} />
          Select
        </label>
      )}

      {clip.sourceType === "UPLOAD" ? (
        <video src={clip.url} controls className="aspect-video w-full rounded bg-black" />
      ) : embedUrl ? (
        <iframe src={embedUrl} className="aspect-video w-full rounded" allowFullScreen />
      ) : (
        <a href={clip.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          Open link ↗
        </a>
      )}

      <div>
        <p className="font-medium">{clip.title}</p>
        <p className="text-sm text-slate-600">
          {clip.player.name} — {clip.skill} — {clip.outcome}
          {clip.opponent ? ` vs ${clip.opponent}` : ""}
        </p>
      </div>
    </div>
  );
}
