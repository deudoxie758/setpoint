import { prisma } from "../src/db/prisma";
import { resetDb } from "./helpers/db";

describe("Prisma schema", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("can create and read a Player", async () => {
    const player = await prisma.player.create({
      data: { name: "Jane Doe", position: "Outside Hitter", graduationYear: 2027 },
    });

    const found = await prisma.player.findUnique({ where: { id: player.id } });

    expect(found?.name).toBe("Jane Doe");
  });

  it("cascades PlaylistClip rows when a Playlist is deleted", async () => {
    const player = await prisma.player.create({ data: { name: "Jane Doe" } });
    const clip = await prisma.clip.create({
      data: {
        title: "Cross-court kill",
        sourceType: "LINK",
        url: "https://youtube.com/watch?v=abc",
        playerId: player.id,
        skill: "SPIKE",
        outcome: "POINT_WON",
      },
    });
    const playlist = await prisma.playlist.create({
      data: { name: "Recruiting Reel", shareToken: "test-token-1" },
    });
    await prisma.playlistClip.create({
      data: { playlistId: playlist.id, clipId: clip.id, position: 0 },
    });

    await prisma.playlist.delete({ where: { id: playlist.id } });

    const remaining = await prisma.playlistClip.findMany({ where: { playlistId: playlist.id } });
    expect(remaining).toHaveLength(0);
  });
});
