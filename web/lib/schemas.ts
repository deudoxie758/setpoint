import { z } from "zod";

export const playerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.string().optional(),
  graduationYear: z.coerce.number().int().optional(),
});
export type PlayerFormValues = z.infer<typeof playerFormSchema>;

export const SKILLS = ["SERVE", "ACE", "SPIKE", "BLOCK", "DIG", "SET", "ASSIST"] as const;
export const OUTCOMES = ["POINT_WON", "POINT_LOST", "NO_POINT"] as const;

export const clipFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    sourceType: z.enum(["LINK", "UPLOAD"]),
    url: z.string().optional(),
    playerId: z.string().min(1, "Select a player"),
    skill: z.enum(SKILLS),
    outcome: z.enum(OUTCOMES),
    opponent: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.sourceType !== "LINK" || /^https?:\/\//.test(data.url ?? ""), {
    message: "Enter a valid URL",
    path: ["url"],
  });
export type ClipFormValues = z.infer<typeof clipFormSchema>;

export const playlistFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
export type PlaylistFormValues = z.infer<typeof playlistFormSchema>;
