import { Router } from "express";
import { z } from "zod";
import { Skill, Outcome, SourceType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";
import { getThumbnailUrl } from "../lib/thumbnail";
import { verifySuggestionToken } from "../lib/aiSuggestionToken";

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
  // Never trust raw aiSuggested/aiConfidence/aiRationale from the client —
  // AI provenance is only ever granted by verifying this token server-side
  // (see aiSuggestionToken.ts), which proves the values actually came from
  // a real POST /ai/suggest-tags call for this exact player/skill/outcome.
  aiSuggestionToken: z.string().optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const { aiSuggestionToken, ...data } = clipInput.parse(req.body);
    const player = await prisma.player.findUnique({ where: { id: data.playerId } });
    if (!player) throw new ApiError(400, "playerId does not reference an existing player");
    const thumbnailUrl = await getThumbnailUrl(data.sourceType, data.url);

    const verified = aiSuggestionToken ? verifySuggestionToken(aiSuggestionToken) : null;
    const aiVerified =
      verified !== null &&
      verified.skill === data.skill &&
      verified.outcome === data.outcome &&
      verified.playerId === data.playerId;

    const clip = await prisma.clip.create({
      data: {
        ...data,
        thumbnailUrl,
        aiSuggested: aiVerified,
        aiConfidence: aiVerified ? verified!.confidence : null,
        aiRationale: aiVerified ? verified!.rationale : null,
      },
    });
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
    const { aiSuggestionToken: _ignoredOnUpdate, ...data } = clipInput.partial().parse(req.body);
    if (data.playerId) {
      const player = await prisma.player.findUnique({ where: { id: data.playerId } });
      if (!player) throw new ApiError(400, "playerId does not reference an existing player");
    }

    // The edit form always resubmits the full record, including url/sourceType,
    // even when neither changed — so only recompute (and, for Vimeo, make a
    // network call) when the value actually differs from what's stored. The
    // read-modify-write is wrapped in a transaction with a row lock so two
    // concurrent edits to the same clip can't interleave and let a slower
    // thumbnail fetch overwrite a newer save with a stale result.
    const clip = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        { id: string; sourceType: SourceType; url: string; skill: Skill; outcome: Outcome }[]
      >`SELECT id, "sourceType", url, skill, outcome FROM "Clip" WHERE id = ${req.params.id} FOR UPDATE`;
      if (locked.length === 0) throw new ApiError(404, "Clip not found");
      const existing = locked[0];

      const sourceTypeChanged = data.sourceType !== undefined && data.sourceType !== existing.sourceType;
      const urlChanged = data.url !== undefined && data.url !== existing.url;

      let thumbnailUrl: string | null | undefined;
      if (sourceTypeChanged || urlChanged) {
        thumbnailUrl = await getThumbnailUrl(data.sourceType ?? existing.sourceType, data.url ?? existing.url);
      }

      // The edit page has no AI-suggestion capability of its own, so any
      // manual change to skill/outcome here can never be re-verified as a
      // real AI suggestion — clear the provenance rather than leave a
      // (now-wrong) AI badge attached to a value a human just overrode.
      const skillChanged = data.skill !== undefined && data.skill !== existing.skill;
      const outcomeChanged = data.outcome !== undefined && data.outcome !== existing.outcome;
      const aiFields =
        skillChanged || outcomeChanged ? { aiSuggested: false, aiConfidence: null, aiRationale: null } : {};

      return tx.clip.update({
        where: { id: req.params.id },
        data: { ...data, ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}), ...aiFields },
      });
    });

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
