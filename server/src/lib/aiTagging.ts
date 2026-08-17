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

export async function suggestTags(frames: string[]): Promise<TagSuggestion> {
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
              "Identify the skill being performed. For the point outcome, judge specifically by how the rally ends in the final frame " +
              "(e.g. the ball being blocked, landing in or out of bounds, or the rally still in progress) rather than the general trajectory of the play.",
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
