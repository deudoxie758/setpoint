import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

const playerInput = z.object({
  name: z.string().min(1),
  position: z.string().optional(),
  graduationYear: z.number().int().optional(),
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
