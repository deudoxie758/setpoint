import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Skill, Outcome } from "@prisma/client";
import { config } from "../config/env";

const suggestionSchema = z.object({
  skill: z.nativeEnum(Skill),
  outcome: z.nativeEnum(Outcome),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

export type TagSuggestion = z.infer<typeof suggestionSchema>;

export interface PlayerContext {
  jerseyColor: string;
  jerseyNumber?: string;
}

const SKILL_DEFINITIONS: Record<Skill, string> = {
  SERVE: "starting the rally by hitting the ball over the net from behind the end line",
  ACE: "a serve that wins the point directly, untouched or misplayed by the receiving team",
  SPIKE: "an attacking player jumping and hitting the ball forcefully downward over the net",
  BLOCK: "one or more players jumping at the net with hands above the net to intercept and stop an opponent's attack right at the net",
  DIG: "a defensive player, often in the back row, saving a hard-driven ball that has already passed the net/block, typically low to the ground",
  SET: "a player using a controlled overhead touch to position the ball for a teammate's attack",
  ASSIST: "a set or pass that directly leads to a teammate scoring the point",
};

const OUTCOME_DEFINITIONS: Record<Outcome, string> = {
  POINT_WON: "the rally ends with this player's team scoring the point",
  POINT_LOST: "the rally ends with the opposing team scoring the point",
  NO_POINT: "the rally is still in progress or ends without either team scoring",
};

function glossary(): string {
  const skills = (Object.keys(SKILL_DEFINITIONS) as Skill[])
    .map((s) => `${s} (${SKILL_DEFINITIONS[s]})`)
    .join("; ");
  const outcomes = (Object.keys(OUTCOME_DEFINITIONS) as Outcome[])
    .map((o) => `${o} (${OUTCOME_DEFINITIONS[o]})`)
    .join("; ");
  return `Skill definitions: ${skills}. Outcome definitions: ${outcomes}.`;
}

const TAG_SUGGESTION_TOOL = {
  name: "suggest_tags",
  description: "Suggest the volleyball skill and point outcome shown across the provided video frames.",
  input_schema: {
    type: "object" as const,
    properties: {
      skill: { type: "string", enum: Object.values(Skill) },
      outcome: { type: "string", enum: Object.values(Outcome) },
      confidence: { type: "number", description: "Confidence from 0 to 1 that this classification is correct." },
      rationale: { type: "string", description: "One sentence explaining what in the frames led to this suggestion." },
    },
    required: ["skill", "outcome", "confidence", "rationale"],
  },
};

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

function toImageBlock(frame: string) {
  const data = frame.replace(/^data:image\/jpeg;base64,/, "");
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
  };
}

function describePlayer(playerContext: PlayerContext): string {
  return playerContext.jerseyNumber
    ? `the player wearing a ${playerContext.jerseyColor} jersey, number ${playerContext.jerseyNumber}`
    : `the player wearing a ${playerContext.jerseyColor} jersey`;
}

export async function suggestTags(frames: string[], playerContext: PlayerContext): Promise<TagSuggestion> {
  const message = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    tools: [TAG_SUGGESTION_TOOL],
    tool_choice: { type: "tool", name: "suggest_tags" },
    messages: [
      {
        role: "user",
        content: [
          ...frames.map(toImageBlock),
          {
            type: "text" as const,
            text:
              "These are frames sampled from a volleyball highlight clip, in chronological order — the last frame is closest to the end of the rally. " +
              `Focus specifically on ${describePlayer(playerContext)}. Identify the skill that player performed. ` +
              "For the point outcome, judge specifically how the rally ends in the final frame for that player's team " +
              "(e.g. their attack landing for a point, their attack being blocked, their team winning the point on defense) " +
              "rather than the general trajectory of the play. " +
              glossary(),
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Model did not return a tool_use response");
  }

  return suggestionSchema.parse(toolUse.input);
}
