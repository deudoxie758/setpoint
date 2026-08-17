import request from "supertest";
import { z } from "zod";

const mockSuggestTags = jest.fn();
jest.mock("../src/lib/aiTagging", () => ({
  suggestTags: (...args: unknown[]) => mockSuggestTags(...args),
}));

import { createApp } from "../src/app";
import { config } from "../src/config/env";
import { verifySuggestionToken } from "../src/lib/aiSuggestionToken";

describe("AI tagging routes", () => {
  const originalKey = config.anthropicApiKey;

  afterEach(() => {
    config.anthropicApiKey = originalKey;
    mockSuggestTags.mockReset();
  });

  describe("GET /ai/status", () => {
    it("reports available when a key is configured", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp()).get("/ai/status");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ available: true });
    });

    it("reports unavailable when no key is configured", async () => {
      config.anthropicApiKey = "";
      const res = await request(createApp()).get("/ai/status");
      expect(res.body).toEqual({ available: false });
    });
  });

  describe("POST /ai/suggest-tags", () => {
    it("returns 503 when unconfigured", async () => {
      config.anthropicApiKey = "";
      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"], jerseyColor: "white", playerId: "p1" });
      expect(res.status).toBe(503);
    });

    it("returns a suggestion plus a signed token when configured, frames are valid, and jerseyColor/playerId are provided", async () => {
      config.anthropicApiKey = "test-key";
      mockSuggestTags.mockResolvedValue({
        skill: "SPIKE",
        outcome: "POINT_WON",
        confidence: 0.8,
        rationale: "Jump and strike.",
      });

      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"], jerseyColor: "white", jerseyNumber: "7", playerId: "p1" });

      expect(res.status).toBe(200);
      expect(res.body.skill).toBe("SPIKE");
      expect(res.body.outcome).toBe("POINT_WON");
      expect(res.body.confidence).toBe(0.8);
      expect(res.body.rationale).toBe("Jump and strike.");
      expect(mockSuggestTags).toHaveBeenCalledWith(["data:image/jpeg;base64,AAA"], {
        jerseyColor: "white",
        jerseyNumber: "7",
      });

      const verified = verifySuggestionToken(res.body.token);
      expect(verified).not.toBeNull();
      expect(verified).toMatchObject({ skill: "SPIKE", outcome: "POINT_WON", confidence: 0.8, playerId: "p1" });
    });

    it("passes the player's position through to suggestTags when provided", async () => {
      config.anthropicApiKey = "test-key";
      mockSuggestTags.mockResolvedValue({
        skill: "BLOCK",
        outcome: "POINT_WON",
        confidence: 0.85,
        rationale: "Blocked at the net.",
      });

      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({
          frames: ["data:image/jpeg;base64,AAA"],
          jerseyColor: "red",
          jerseyNumber: "5",
          position: "Middle Blocker",
          playerId: "p1",
        });

      expect(res.status).toBe(200);
      expect(mockSuggestTags).toHaveBeenCalledWith(["data:image/jpeg;base64,AAA"], {
        jerseyColor: "red",
        jerseyNumber: "5",
        position: "Middle Blocker",
      });
    });

    it("returns 400 when frames is missing", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp()).post("/ai/suggest-tags").send({ jerseyColor: "white", playerId: "p1" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when frames is an empty array", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: [], jerseyColor: "white", playerId: "p1" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when jerseyColor is missing", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"], playerId: "p1" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when jerseyColor is an empty string", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"], jerseyColor: "", playerId: "p1" });
      expect(res.status).toBe(400);
    });

    it("returns 400 when playerId is missing", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"], jerseyColor: "white" });
      expect(res.status).toBe(400);
    });

    it("accepts a request without jerseyNumber, since it's optional", async () => {
      config.anthropicApiKey = "test-key";
      mockSuggestTags.mockResolvedValue({
        skill: "SPIKE",
        outcome: "POINT_WON",
        confidence: 0.8,
        rationale: "Jump and strike.",
      });

      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"], jerseyColor: "white", playerId: "p1" });

      expect(res.status).toBe(200);
      expect(mockSuggestTags).toHaveBeenCalledWith(["data:image/jpeg;base64,AAA"], { jerseyColor: "white" });
    });

    it("accepts a realistic multi-frame payload larger than Express's default 100kb body limit", async () => {
      config.anthropicApiKey = "test-key";
      mockSuggestTags.mockResolvedValue({
        skill: "SPIKE",
        outcome: "POINT_WON",
        confidence: 0.8,
        rationale: "Jump and strike.",
      });
      // ~50kb per frame x 9 frames, matching a real 640x480 JPEG data URI payload
      const frames = Array(9).fill("data:image/jpeg;base64," + "A".repeat(50_000));

      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames, jerseyColor: "white", playerId: "p1" });

      expect(res.status).toBe(200);
    });

    it("returns 400 when frames has more than 9 items", async () => {
      config.anthropicApiKey = "test-key";
      const frames = Array(10).fill("data:image/jpeg;base64,AAA");
      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames, jerseyColor: "white", playerId: "p1" });
      expect(res.status).toBe(400);
    });

    it("returns 502 (not 400) when the suggestion lib throws a generic error", async () => {
      config.anthropicApiKey = "test-key";
      mockSuggestTags.mockRejectedValue(new Error("boom"));

      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"], jerseyColor: "white", playerId: "p1" });

      expect(res.status).toBe(502);
    });

    it("returns 502 (not 400) when the suggestion lib throws a ZodError from validating the model's own response", async () => {
      config.anthropicApiKey = "test-key";
      const modelValidationError = new z.ZodError([
        { code: "invalid_enum_value", path: ["skill"], message: "Invalid enum value", options: [], received: "X" },
      ]);
      mockSuggestTags.mockRejectedValue(modelValidationError);

      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"], jerseyColor: "white", playerId: "p1" });

      expect(res.status).toBe(502);
    });

    it("still returns 400 for a genuine client request-validation error, not 502", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp()).post("/ai/suggest-tags").send({ frames: [], playerId: "p1" });
      expect(res.status).toBe(400);
      expect(mockSuggestTags).not.toHaveBeenCalled();
    });
  });
});
