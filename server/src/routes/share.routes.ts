import { Router } from "express";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

router.get("/:token", async (req, res, next) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { shareToken: req.params.token },
      include: {
        clips: {
          orderBy: { position: "asc" },
          include: { clip: { include: { player: true } } },
        },
      },
    });
    if (!playlist) throw new ApiError(404, "This playlist link is no longer valid");

    res.json({
      playlist: {
        name: playlist.name,
        description: playlist.description,
        clips: playlist.clips.map((pc) => pc.clip),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
