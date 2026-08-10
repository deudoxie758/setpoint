import { prisma } from "../../src/db/prisma";

export async function resetDb() {
  await prisma.playlistClip.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.clip.deleteMany();
  await prisma.player.deleteMany();
}
