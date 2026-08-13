import { reorderClipIds } from "@/lib/reorder";
import { PlaylistClip, ClipWithPlayer } from "@/lib/types";

function makeClip(clipId: string, position: number): PlaylistClip {
  const clip: ClipWithPlayer = {
    id: clipId,
    title: clipId,
    sourceType: "LINK",
    url: "https://example.com",
    playerId: "p1",
    skill: "SPIKE",
    outcome: "POINT_WON",
    opponent: null,
    matchDate: null,
    notes: null,
    createdAt: "2026-01-01",
    player: { id: "p1", name: "Jane", position: null, graduationYear: null, createdAt: "2026-01-01" },
  };
  return { playlistId: "pl1", clipId, position, clip };
}

describe("reorderClipIds", () => {
  it("moves a clip from one position to another", () => {
    const clips = [makeClip("a", 0), makeClip("b", 1), makeClip("c", 2)];
    expect(reorderClipIds(clips, "a", "c")).toEqual(["b", "c", "a"]);
  });

  it("returns the original order when either id is unknown", () => {
    const clips = [makeClip("a", 0), makeClip("b", 1)];
    expect(reorderClipIds(clips, "a", "does-not-exist")).toEqual(["a", "b"]);
  });
});
