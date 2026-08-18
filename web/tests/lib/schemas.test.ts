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

  it("accepts a position from the fixed set", () => {
    const result = playerFormSchema.safeParse({ name: "Jane Doe", position: "Setter" });
    expect(result.success).toBe(true);
  });

  it("rejects a position outside the fixed set", () => {
    const result = playerFormSchema.safeParse({ name: "Jane Doe", position: "Outside Hitter" });
    expect(result.success).toBe(false);
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

  it("accepts an optional matchDate", () => {
    const result = clipFormSchema.parse({ ...base, url: "https://youtube.com/watch?v=abc123", matchDate: "2026-03-01" });
    expect(result.matchDate).toBe("2026-03-01");
  });

  it("leaves matchDate unset when the field is blank", () => {
    const result = clipFormSchema.parse({ ...base, url: "https://youtube.com/watch?v=abc123", matchDate: "" });
    expect(result.matchDate).toBeUndefined();
  });
});
