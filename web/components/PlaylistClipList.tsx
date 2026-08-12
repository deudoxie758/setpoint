"use client";

import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlaylistClip } from "@/lib/types";
import { reorderClipIds } from "@/lib/reorder";

interface Props {
  clips: PlaylistClip[];
  onReorder: (clipIds: string[]) => void;
  onRemove: (clipId: string) => void;
}

export function PlaylistClipList({ clips, onReorder, onRemove }: Props) {
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(reorderClipIds(clips, String(active.id), String(over.id)));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={clips.map((c) => c.clipId)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {clips.map((pc) => (
            <SortableClipRow key={pc.clipId} playlistClip={pc} onRemove={onRemove} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableClipRow({
  playlistClip,
  onRemove,
}: {
  playlistClip: PlaylistClip;
  onRemove: (clipId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: playlistClip.clipId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between rounded border bg-white p-3">
      <div {...attributes} {...listeners} className="cursor-grab">
        {playlistClip.clip.title} — {playlistClip.clip.player.name}
      </div>
      <button type="button" onClick={() => onRemove(playlistClip.clipId)} className="text-sm text-red-600">
        Remove
      </button>
    </li>
  );
}
