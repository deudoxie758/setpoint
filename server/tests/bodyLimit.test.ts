import request from "supertest";
import { createApp } from "../src/app";

describe("JSON body size limit scoping", () => {
  it("rejects an oversized body on an ordinary route (not raised app-wide)", async () => {
    const app = createApp();
    const oversized = "A".repeat(200_000); // > Express's 100kb default
    const res = await request(app).post("/players").send({ name: oversized });
    expect(res.status).toBe(413);
  });

  it("accepts a larger body specifically on /ai/suggest-tags", async () => {
    const app = createApp();
    const frames = Array(9).fill("data:image/jpeg;base64," + "A".repeat(50_000));
    const res = await request(app)
      .post("/ai/suggest-tags")
      .send({ frames, jerseyColor: "white", playerId: "p1" });
    // Not configured in this test env, but a 503 (not 413) proves the body
    // was accepted and parsed before the "not configured" check ran.
    expect(res.status).not.toBe(413);
  });
});
