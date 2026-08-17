import { Router } from "express";
import { z } from "zod";
import { config } from "../config/env";
import { ApiError } from "../middleware/errorHandler";
import { suggestTags } from "../lib/aiTagging";
import { signSuggestion } from "../lib/aiSuggestionToken";

const router = Router();

const MAX_FRAMES = 9;
const MAX_FRAME_LENGTH = 2_000_000;

const suggestInput = z.object({
  frames: z.array(z.string().min(1).max(MAX_FRAME_LENGTH)).min(1).max(MAX_FRAMES),
  jerseyColor: z.string().min(1, "Jersey color is required"),
  jerseyNumber: z.string().optional(),
  position: z.string().optional(),
  playerId: z.string().min(1, "playerId is required"),
});

router.get("/status", (_req, res) => {
  res.json({ available: Boolean(config.anthropicApiKey) });
});

router.post("/suggest-tags", async (req, res, next) => {
  if (!config.anthropicApiKey) {
    return next(new ApiError(503, "AI tagging is not configured"));
  }

  let input: z.infer<typeof suggestInput>;
  try {
    input = suggestInput.parse(req.body);
  } catch (err) {
    return next(err);
  }

  try {
    const suggestion = await suggestTags(input.frames, {
      jerseyColor: input.jerseyColor,
      jerseyNumber: input.jerseyNumber,
      position: input.position,
    });
    const token = signSuggestion(suggestion, input.playerId);
    res.json({ ...suggestion, token });
  } catch (err) {
    // Anything here is an upstream failure (bad API key, timeout, rate limit,
    // or the model's own response failing validation) — never the client's
    // fault, so it's always a 502, logged server-side since the client only
    // sees the generic message.
    console.error("AI suggestion failed:", err);
    next(new ApiError(502, "AI suggestion failed"));
  }
});

export default router;
