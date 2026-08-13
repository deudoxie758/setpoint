import Link from "next/link";
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

function ClipMedia({ clip, readOnly }: { clip: ClipWithPlayer; readOnly: boolean }) {
  const embedUrl = clip.sourceType === "LINK" ? getEmbedUrl(clip.url) : null;

  // Uploaded clips and the public share page always get a live, playable
  // player rather than a static thumbnail. The thumbnail swap exists to avoid
  // mounting a live YouTube/Vimeo <iframe> per card in a grid of many —
  // that cost doesn't apply to a plain <video> tag (no iframe, no third-party
  // embed), so uploads keep the inline player everywhere, same as before the
  // thumbnail work. The share page has no other page to click through to
  // watch a clip, so it always gets the live embed too.
  if (readOnly || clip.sourceType === "UPLOAD") {
    if (clip.sourceType === "UPLOAD") {
      return <video src={clip.url} controls className="aspect-video w-full rounded-lg bg-black" />;
    }
    if (embedUrl) {
      return <iframe src={embedUrl} className="aspect-video w-full rounded-lg" allowFullScreen />;
    }
    return (
      <a
        href={clip.url}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-video w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-cyan-300 underline"
      >
        Open link ↗
      </a>
    );
  }

  return (
    <Link
      href={`/clips/${clip.id}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-black"
    >
      {clip.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={clip.thumbnailUrl} alt={clip.title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.03] text-slate-600">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-10 w-10 text-white opacity-0 transition group-hover:opacity-100"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </Link>
  );
}

export function ClipCard({ clip, selected = false, onToggleSelected, readOnly = false }: Props) {
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

      <ClipMedia clip={clip} readOnly={readOnly} />

      <div className="flex flex-col gap-2">
        {readOnly ? (
          <p className="font-medium text-slate-100">{clip.title}</p>
        ) : (
          <Link href={`/clips/${clip.id}`} className="font-medium text-slate-100 hover:text-cyan-300">
            {clip.title}
          </Link>
        )}
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
