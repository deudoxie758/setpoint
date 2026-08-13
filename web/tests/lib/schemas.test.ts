import { playerFormSchema, clipFormSchema } from "@/lib/schemas";

describe("playerFormSchema", () => {
  it("leaves graduationYear unset when the field is blank, rather than coercing to 0", () => {
    const result = playerFormSchema.parse({ name: "Jane Doe", graduationYear: "" });
    expect(result.graduationYear).toBeUndefined();
  });

  it("leaves position unset when the field is blank", () => {
    const result = playerFormSchema.parse({ name: "Jane Doe", position: "" });
    expect(result.position).toBeUndefined();
  });

  it("still coerces a real numeric string for graduationYear", () => {
    const result = playerFormSchema.parse({ name: "Jane Doe", graduationYear: "2027" });
    expect(result.graduationYear).toBe(2027);
  });
});

describe("clipFormSchema", () => {
  const base = {
    title: "Cross-court kill",
    sourceType: "LINK" as const,
    playerId: "p1",
    skill: "SPIKE" as const,
    outcome: "POINT_WON" as const,
  };

  it("accepts a fully-formed URL in LINK mode", () => {
    const result = clipFormSchema.safeParse({ ...base, url: "https://youtube.com/watch?v=abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects a URL with no host, matching the backend's stricter validation", () => {
    const result = clipFormSchema.safeParse({ ...base, url: "https://" });
    expect(result.success).toBe(false);
  });

  it("does not require url validation in UPLOAD mode", () => {
    const result = clipFormSchema.safeParse({ ...base, sourceType: "UPLOAD", url: undefined });
    expect(result.success).toBe(true);
  });
});
