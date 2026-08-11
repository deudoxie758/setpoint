import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";
import { generateShareToken } from "../lib/shareToken";

const router = Router();

const playlistInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

function withOrderedClips() {
  return {
    clips: {
      orderBy: { position: "asc" as const },
      include: { clip: { include: { player: true } } },
    },
  };
}

router.post("/", async (req, res, next) => {
  try {
    const data = playlistInput.parse(req.body);
    const playlist = await prisma.playlist.create({
      data: { ...data, shareToken: generateShareToken() },
    });
    res.status(201).json({ playlist });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const playlists = await prisma.playlist.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ playlists });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
      include: withOrderedClips(),
    });
    if (!playlist) throw new ApiError(404, "Playlist not found");
    res.json({ playlist });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const data = playlistInput.partial().parse(req.body);
    const playlist = await prisma.playlist.update({ where: { id: req.params.id }, data });
    res.json({ playlist });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.playlist.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const addClipsInput = z.object({ clipIds: z.array(z.string().min(1)).min(1) });

router.post("/:id/clips", async (req, res, next) => {
  try {
    const { clipIds } = addClipsInput.parse(req.body);
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw new ApiError(404, "Playlist not found");

    const last = await prisma.playlistClip.findFirst({
      where: { playlistId: playlist.id },
      orderBy: { position: "desc" },
    });
    const nextPosition = last ? last.position + 1 : 0;

    await prisma.playlistClip.createMany({
      data: clipIds.map((clipId, i) => ({
        playlistId: playlist.id,
        clipId,
        position: nextPosition + i,
      })),
      skipDuplicates: true,
    });

    const updated = await prisma.playlist.findUnique({
      where: { id: playlist.id },
      include: withOrderedClips(),
    });
    res.status(201).json({ playlist: updated });
  } catch (err) {
    next(err);
  }
});

const reorderInput = z.object({ clipIds: z.array(z.string().min(1)) });

router.patch("/:id/clips/reorder", async (req, res, next) => {
  try {
    const { clipIds } = reorderInput.parse(req.body);
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw new ApiError(404, "Playlist not found");

    await prisma.$transaction(
      clipIds.map((clipId, position) =>
        prisma.playlistClip.update({
          where: { playlistId_clipId: { playlistId: playlist.id, clipId } },
          data: { position },
        })
      )
    );

    const updated = await prisma.playlist.findUnique({
      where: { id: playlist.id },
      include: withOrderedClips(),
    });
    res.json({ playlist: updated });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/clips/:clipId", async (req, res, next) => {
  try {
    await prisma.playlistClip.delete({
      where: {
        playlistId_clipId: { playlistId: req.params.id, clipId: req.params.clipId },
      },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
