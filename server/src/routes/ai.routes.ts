import { Router } from "express";
import { z } from "zod";
import { config } from "../config/env";
import { ApiError } from "../middleware/errorHandler";
import { suggestTags } from "../lib/aiTagging";

const router = Router();

const MAX_FRAMES = 9;
const MAX_FRAME_LENGTH = 2_000_000;

const suggestInput = z.object({
  frames: z.array(z.string().min(1).max(MAX_FRAME_LENGTH)).min(1).max(MAX_FRAMES),
});

router.get("/status", (_req, res) => {
  res.json({ available: Boolean(config.anthropicApiKey) });
});

router.post("/suggest-tags", async (req, res, next) => {
  try {
    if (!config.anthropicApiKey) {
      throw new ApiError(503, "AI tagging is not configured");
    }

    const { frames } = suggestInput.parse(req.body);
    const suggestion = await suggestTags(frames);
    res.json(suggestion);
  } catch (err) {
    if (err instanceof ApiError || err instanceof z.ZodError) {
      return next(err);
    }
    next(new ApiError(502, "AI suggestion failed"));
  }
});

export default router;
