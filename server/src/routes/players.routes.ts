import { Router } from "express";
import { z } from "zod";
import { Outcome } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

const playerInput = z.object({
  name: z.string().min(1),
  position: z.string().nullable().optional(),
  graduationYear: z.number().int().nullable().optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const data = playerInput.parse(req.body);
    const player = await prisma.player.create({ data });
    res.status(201).json({ player });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const players = await prisma.player.findMany({ orderBy: { name: "asc" } });
    res.json({ players });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) throw new ApiError(404, "Player not found");
    res.json({ player });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/stats", async (req, res, next) => {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) throw new ApiError(404, "Player not found");

    const grouped = await prisma.clip.groupBy({
      by: ["skill", "outcome"],
      where: { playerId: player.id },
      _count: true,
    });

    function pct(count: number, total: number): number | null {
      return total > 0 ? Math.round((count / total) * 1000) / 10 : null;
    }

    const totalClips = grouped.reduce((sum, g) => sum + g._count, 0);
    const outcomeTotals: Record<Outcome, number> = { POINT_WON: 0, POINT_LOST: 0, NO_POINT: 0 };
    for (const g of grouped) outcomeTotals[g.outcome] += g._count;

    type SkillTotals = Record<Outcome, number> & { count: number };
    const bySkillMap = new Map<string, SkillTotals>();
    for (const g of grouped) {
      const entry = bySkillMap.get(g.skill) ?? { count: 0, POINT_WON: 0, POINT_LOST: 0, NO_POINT: 0 };
      entry.count += g._count;
      entry[g.outcome] += g._count;
      bySkillMap.set(g.skill, entry);
    }

    const bySkill = Array.from(bySkillMap.entries()).map(([skill, s]) => ({
      skill,
      count: s.count,
      pointWonPct: pct(s.POINT_WON, s.count),
      pointLostPct: pct(s.POINT_LOST, s.count),
      noPointPct: pct(s.NO_POINT, s.count),
    }));

    const spike = bySkillMap.get("SPIKE");
    const attackEfficiency =
      spike && spike.count > 0 ? Math.round(((spike.POINT_WON - spike.POINT_LOST) / spike.count) * 1000) / 1000 : null;

    res.json({
      stats: {
        totalClips,
        pointWonPct: pct(outcomeTotals.POINT_WON, totalClips),
        pointLostPct: pct(outcomeTotals.POINT_LOST, totalClips),
        noPointPct: pct(outcomeTotals.NO_POINT, totalClips),
        attackEfficiency,
        bySkill,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const data = playerInput.partial().parse(req.body);
    const player = await prisma.player.update({ where: { id: req.params.id }, data });
    res.json({ player });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.player.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
