import { Router } from "express";
import { z } from "zod";
import { Skill, Outcome, SourceType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

const clipInput = z.object({
  title: z.string().min(1),
  sourceType: z.nativeEnum(SourceType),
  url: z.string().url(),
  playerId: z.string().min(1),
  skill: z.nativeEnum(Skill),
  outcome: z.nativeEnum(Outcome),
  opponent: z.string().optional(),
  matchDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const data = clipInput.parse(req.body);
    const player = await prisma.player.findUnique({ where: { id: data.playerId } });
    if (!player) throw new ApiError(400, "playerId does not reference an existing player");
    const clip = await prisma.clip.create({ data });
    res.status(201).json({ clip });
  } catch (err) {
    next(err);
  }
});

const listQuery = z.object({
  playerId: z.string().optional(),
  skill: z.nativeEnum(Skill).optional(),
  outcome: z.nativeEnum(Outcome).optional(),
  opponent: z.string().optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const filters = listQuery.parse(req.query);
    const clips = await prisma.clip.findMany({
      where: {
        playerId: filters.playerId,
        skill: filters.skill,
        outcome: filters.outcome,
        opponent: filters.opponent ? { contains: filters.opponent, mode: "insensitive" } : undefined,
      },
      include: { player: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ clips });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({
      where: { id: req.params.id },
      include: { player: true },
    });
    if (!clip) throw new ApiError(404, "Clip not found");
    res.json({ clip });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const data = clipInput.partial().parse(req.body);
    if (data.playerId) {
      const player = await prisma.player.findUnique({ where: { id: data.playerId } });
      if (!player) throw new ApiError(400, "playerId does not reference an existing player");
    }
    const clip = await prisma.clip.update({ where: { id: req.params.id }, data });
    res.json({ clip });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.clip.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
