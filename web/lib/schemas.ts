import { z } from "zod";

function blankToUndefined(value: unknown) {
  return value === "" || value === undefined ? undefined : value;
}

export const playerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.preprocess(blankToUndefined, z.string().optional()),
  graduationYear: z.preprocess(blankToUndefined, z.coerce.number().int().optional()),
});
export type PlayerFormValues = z.infer<typeof playerFormSchema>;

export const SOURCE_TYPES = ["LINK", "UPLOAD"] as const;
export const SKILLS = ["SERVE", "ACE", "SPIKE", "BLOCK", "DIG", "SET", "ASSIST"] as const;
export const OUTCOMES = ["POINT_WON", "POINT_LOST", "NO_POINT"] as const;

function isValidHttpUrl(value: string): boolean {
  return z.string().url().safeParse(value).success;
}

export const clipFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    sourceType: z.enum(SOURCE_TYPES),
    url: z.string().optional(),
    playerId: z.string().min(1, "Select a player"),
    skill: z.enum(SKILLS),
    outcome: z.enum(OUTCOMES),
    opponent: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.sourceType !== "LINK" || isValidHttpUrl(data.url ?? ""), {
    message: "Enter a valid URL",
    path: ["url"],
  });
export type ClipFormValues = z.infer<typeof clipFormSchema>;

export const playlistFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
export type PlaylistFormValues = z.infer<typeof playlistFormSchema>;
