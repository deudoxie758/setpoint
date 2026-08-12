import { arrayMove } from "@dnd-kit/sortable";
import { PlaylistClip } from "@/lib/types";

export function reorderClipIds(clips: PlaylistClip[], activeClipId: string, overClipId: string): string[] {
  const ids = clips.map((c) => c.clipId);
  const oldIndex = ids.indexOf(activeClipId);
  const newIndex = ids.indexOf(overClipId);
  if (oldIndex === -1 || newIndex === -1) return ids;
  return arrayMove(ids, oldIndex, newIndex);
}
