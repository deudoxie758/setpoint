import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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

    const playlist = await prisma.$transaction(async (tx) => {
      // Lock the playlist row so concurrent add-clips calls for the same
      // playlist serialize instead of racing on the nextPosition read below.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Playlist" WHERE id = ${req.params.id} FOR UPDATE
      `;
      if (locked.length === 0) throw new ApiError(404, "Playlist not found");

      const uniqueClipIds = [...new Set(clipIds)];
      const existingClips = await tx.clip.findMany({
        where: { id: { in: uniqueClipIds } },
        select: { id: true },
      });
      if (existingClips.length !== uniqueClipIds.length) {
        throw new ApiError(400, "One or more clipIds do not reference an existing clip");
      }

      const last = await tx.playlistClip.findFirst({
        where: { playlistId: req.params.id },
        orderBy: { position: "desc" },
      });
      const nextPosition = last ? last.position + 1 : 0;

      await tx.playlistClip.createMany({
        data: clipIds.map((clipId, i) => ({
          playlistId: req.params.id,
          clipId,
          position: nextPosition + i,
        })),
        skipDuplicates: true,
      });

      return tx.playlist.findUnique({
        where: { id: req.params.id },
        include: withOrderedClips(),
      });
    });

    res.status(201).json({ playlist });
  } catch (err) {
    next(err);
  }
});

const reorderInput = z.object({ clipIds: z.array(z.string().min(1)) });

router.patch("/:id/clips/reorder", async (req, res, next) => {
  try {
    const { clipIds } = reorderInput.parse(req.body);
    if (new Set(clipIds).size !== clipIds.length) {
      throw new ApiError(400, "clipIds must not contain duplicates");
    }

    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw new ApiError(404, "Playlist not found");

    const existing = await prisma.playlistClip.findMany({
      where: { playlistId: playlist.id },
      select: { clipId: true },
    });
    const existingIds = new Set(existing.map((pc) => pc.clipId));
    const providedIds = new Set(clipIds);
    const isFullReorder =
      existingIds.size === providedIds.size && [...existingIds].every((id) => providedIds.has(id));
    if (!isFullReorder) {
      throw new ApiError(400, "clipIds must be a full reordering of the playlist's current clips");
    }

    if (clipIds.length > 0) {
      const rows = Prisma.join(
        clipIds.map((clipId, position) => Prisma.sql`(${clipId}::text, ${position}::int)`)
      );
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "PlaylistClip" AS pc
        SET position = v.position
        FROM (VALUES ${rows}) AS v(clip_id, position)
        WHERE pc."playlistId" = ${playlist.id} AND pc."clipId" = v.clip_id
      `);
    }

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
