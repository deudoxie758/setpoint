import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "./helpers/db";
import { createPlayer } from "./helpers/fixtures";
import { signSuggestion } from "../src/lib/aiSuggestionToken";

const app = createApp();

const validSuggestion = {
  skill: "BLOCK" as const,
  outcome: "POINT_WON" as const,
  confidence: 0.78,
  rationale: "Red jersey #5 blocks the attack at the net.",
};

describe("Clips", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("persists AI provenance when a valid, matching aiSuggestionToken is provided", async () => {
    const playerId = await createPlayer(app);
    const token = signSuggestion(validSuggestion, playerId);

    const res = await request(app).post("/clips").send({
      title: "AI-tagged kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=ai1",
      playerId,
      skill: "BLOCK",
      outcome: "POINT_WON",
      aiSuggestionToken: token,
    });

    expect(res.status).toBe(201);
    expect(res.body.clip.aiSuggested).toBe(true);
    expect(res.body.clip.aiConfidence).toBe(0.78);
    expect(res.body.clip.aiRationale).toBe("Red jersey #5 blocks the attack at the net.");
  });

  it("defaults AI provenance to unset when no token is provided", async () => {
    const playerId = await createPlayer(app);

    const res = await request(app).post("/clips").send({
      title: "Manually tagged kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=manual1",
      playerId,
      skill: "SPIKE",
      outcome: "POINT_WON",
    });

    expect(res.status).toBe(201);
    expect(res.body.clip.aiSuggested).toBe(false);
    expect(res.body.clip.aiConfidence).toBeNull();
    expect(res.body.clip.aiRationale).toBeNull();
  });

  it("ignores a raw aiSuggested/aiConfidence/aiRationale sent directly by the client (fabrication is not possible)", async () => {
    const playerId = await createPlayer(app);

    const res = await request(app)
      .post("/clips")
      .send({
        title: "Spoofed kill",
        sourceType: "LINK",
        url: "https://youtube.com/watch?v=spoof1",
        playerId,
        skill: "SPIKE",
        outcome: "POINT_WON",
        // These raw fields are no longer part of the accepted schema at all —
        // a client can no longer just assert its own AI provenance.
        aiSuggested: true,
        aiConfidence: 0.99,
        aiRationale: "Definitely real, trust me.",
      });

    expect(res.status).toBe(201);
    expect(res.body.clip.aiSuggested).toBe(false);
    expect(res.body.clip.aiConfidence).toBeNull();
    expect(res.body.clip.aiRationale).toBeNull();
  });

  it("does not grant AI provenance when the token's skill/outcome don't match the submitted clip", async () => {
    const playerId = await createPlayer(app);
    const token = signSuggestion(validSuggestion, playerId); // token says BLOCK/POINT_WON

    const res = await request(app).post("/clips").send({
      title: "Mismatched kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=mismatch1",
      playerId,
      skill: "SPIKE", // submitted skill differs from the token
      outcome: "POINT_WON",
      aiSuggestionToken: token,
    });

    expect(res.status).toBe(201);
    expect(res.body.clip.aiSuggested).toBe(false);
    expect(res.body.clip.aiConfidence).toBeNull();
    expect(res.body.clip.aiRationale).toBeNull();
  });

  it("does not grant AI provenance when the token was issued for a different player", async () => {
    const playerId = await createPlayer(app);
    const otherPlayerId = await createPlayer(app, "Other Player");
    const token = signSuggestion(validSuggestion, otherPlayerId);

    const res = await request(app).post("/clips").send({
      title: "Wrong player kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=wrongplayer1",
      playerId,
      skill: "BLOCK",
      outcome: "POINT_WON",
      aiSuggestionToken: token,
    });

    expect(res.status).toBe(201);
    expect(res.body.clip.aiSuggested).toBe(false);
    expect(res.body.clip.aiConfidence).toBeNull();
    expect(res.body.clip.aiRationale).toBeNull();
  });

  it("does not grant AI provenance for a garbage/tampered token", async () => {
    const playerId = await createPlayer(app);

    const res = await request(app).post("/clips").send({
      title: "Fake token kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=faketoken1",
      playerId,
      skill: "BLOCK",
      outcome: "POINT_WON",
      aiSuggestionToken: "not-a-real-token",
    });

    expect(res.status).toBe(201);
    expect(res.body.clip.aiSuggested).toBe(false);
  });

  it("creates a clip and rejects an unknown playerId", async () => {
    const playerId = await createPlayer(app);

    const createRes = await request(app).post("/clips").send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=abc",
      playerId,
      skill: "SPIKE",
      outcome: "POINT_WON",
      opponent: "Rival High School",
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.clip.title).toBe("Cross-court kill");

    const badPlayerRes = await request(app).post("/clips").send({
      title: "Bad clip",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=xyz",
      playerId: "does-not-exist",
      skill: "SPIKE",
      outcome: "POINT_WON",
    });
    expect(badPlayerRes.status).toBe(400);
  });

  it("filters clips by playerId, skill, and opponent", async () => {
    const playerA = await createPlayer(app, "Jane Doe");
    const playerB = await createPlayer(app, "Sam Lee");

    await request(app).post("/clips").send({
      title: "Jane kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=1",
      playerId: playerA,
      skill: "SPIKE",
      outcome: "POINT_WON",
      opponent: "Rival High School",
    });
    await request(app).post("/clips").send({
      title: "Jane ace",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=2",
      playerId: playerA,
      skill: "ACE",
      outcome: "POINT_WON",
      opponent: "Other School",
    });
    await request(app).post("/clips").send({
      title: "Sam kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=3",
      playerId: playerB,
      skill: "SPIKE",
      outcome: "POINT_WON",
      opponent: "Rival High School",
    });

    const byPlayer = await request(app).get(`/clips?playerId=${playerA}`);
    expect(byPlayer.body.clips).toHaveLength(2);

    const bySkill = await request(app).get("/clips?skill=SPIKE");
    expect(bySkill.body.clips).toHaveLength(2);

    const byOpponent = await request(app).get("/clips?opponent=Rival");
    expect(byOpponent.body.clips).toHaveLength(2);

    const combined = await request(app).get(`/clips?playerId=${playerA}&skill=ACE`);
    expect(combined.body.clips).toHaveLength(1);
    expect(combined.body.clips[0].title).toBe("Jane ace");
  });

  it("gets, updates, and deletes a single clip", async () => {
    const playerId = await createPlayer(app);
    const createRes = await request(app).post("/clips").send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=abc",
      playerId,
      skill: "SPIKE",
      outcome: "POINT_WON",
    });
    const id = createRes.body.clip.id;

    const getRes = await request(app).get(`/clips/${id}`);
    expect(getRes.status).toBe(200);

    const updateRes = await request(app).patch(`/clips/${id}`).send({ outcome: "POINT_LOST" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clip.outcome).toBe("POINT_LOST");

    const deleteRes = await request(app).delete(`/clips/${id}`);
    expect(deleteRes.status).toBe(204);

    const afterDelete = await request(app).get(`/clips/${id}`);
    expect(afterDelete.status).toBe(404);
  });

  it("returns 400 when updating a clip's playerId to an unknown player", async () => {
    const playerId = await createPlayer(app);
    const createRes = await request(app).post("/clips").send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=abc",
      playerId,
      skill: "SPIKE",
      outcome: "POINT_WON",
    });
    const id = createRes.body.clip.id;

    const updateRes = await request(app).patch(`/clips/${id}`).send({ playerId: "does-not-exist" });
    expect(updateRes.status).toBe(400);
  });

  it("clears AI provenance when a manual edit changes the skill on a previously AI-tagged clip", async () => {
    const playerId = await createPlayer(app);
    const token = signSuggestion(validSuggestion, playerId);
    const createRes = await request(app).post("/clips").send({
      title: "AI-tagged kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=clearskill1",
      playerId,
      skill: "BLOCK",
      outcome: "POINT_WON",
      aiSuggestionToken: token,
    });
    expect(createRes.body.clip.aiSuggested).toBe(true);
    const id = createRes.body.clip.id;

    const updateRes = await request(app).patch(`/clips/${id}`).send({ skill: "SPIKE" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clip.skill).toBe("SPIKE");
    expect(updateRes.body.clip.aiSuggested).toBe(false);
    expect(updateRes.body.clip.aiConfidence).toBeNull();
    expect(updateRes.body.clip.aiRationale).toBeNull();
  });

  it("clears AI provenance when a manual edit changes the outcome on a previously AI-tagged clip", async () => {
    const playerId = await createPlayer(app);
    const token = signSuggestion(validSuggestion, playerId);
    const createRes = await request(app).post("/clips").send({
      title: "AI-tagged kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=clearoutcome1",
      playerId,
      skill: "BLOCK",
      outcome: "POINT_WON",
      aiSuggestionToken: token,
    });
    const id = createRes.body.clip.id;

    const updateRes = await request(app).patch(`/clips/${id}`).send({ outcome: "POINT_LOST" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clip.aiSuggested).toBe(false);
    expect(updateRes.body.clip.aiConfidence).toBeNull();
    expect(updateRes.body.clip.aiRationale).toBeNull();
  });

  it("leaves AI provenance untouched when an edit doesn't change skill or outcome", async () => {
    const playerId = await createPlayer(app);
    const token = signSuggestion(validSuggestion, playerId);
    const createRes = await request(app).post("/clips").send({
      title: "AI-tagged kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=untouched1",
      playerId,
      skill: "BLOCK",
      outcome: "POINT_WON",
      aiSuggestionToken: token,
    });
    const id = createRes.body.clip.id;

    const updateRes = await request(app).patch(`/clips/${id}`).send({ title: "Renamed kill" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clip.title).toBe("Renamed kill");
    expect(updateRes.body.clip.aiSuggested).toBe(true);
    expect(updateRes.body.clip.aiConfidence).toBe(0.78);
    expect(updateRes.body.clip.aiRationale).toBe("Red jersey #5 blocks the attack at the net.");
  });

  it("leaves AI provenance untouched when skill/outcome are resubmitted unchanged", async () => {
    const playerId = await createPlayer(app);
    const token = signSuggestion(validSuggestion, playerId);
    const createRes = await request(app).post("/clips").send({
      title: "AI-tagged kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=resubmit1",
      playerId,
      skill: "BLOCK",
      outcome: "POINT_WON",
      aiSuggestionToken: token,
    });
    const id = createRes.body.clip.id;

    // Edit form always resubmits the full record, including unchanged fields.
    const updateRes = await request(app).patch(`/clips/${id}`).send({ skill: "BLOCK", outcome: "POINT_WON" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clip.aiSuggested).toBe(true);
  });
});

describe("Clip thumbnails", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("computes a thumbnailUrl for a YouTube link on create", async () => {
    const playerId = await createPlayer(app);
    const res = await request(app).post("/clips").send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://www.youtube.com/watch?v=abc123",
      playerId,
      skill: "SPIKE",
      outcome: "POINT_WON",
    });

    expect(res.status).toBe(201);
    expect(res.body.clip.thumbnailUrl).toBe("https://img.youtube.com/vi/abc123/hqdefault.jpg");
  });

  it("has a null thumbnailUrl for an UPLOAD clip", async () => {
    const playerId = await createPlayer(app);
    const res = await request(app).post("/clips").send({
      title: "Uploaded clip",
      sourceType: "UPLOAD",
      url: "https://storage.example.com/clip.mp4",
      playerId,
      skill: "DIG",
      outcome: "NO_POINT",
    });

    expect(res.status).toBe(201);
    expect(res.body.clip.thumbnailUrl).toBeNull();
  });

  it("recomputes thumbnailUrl when the url is updated", async () => {
    const playerId = await createPlayer(app);
    const createRes = await request(app).post("/clips").send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://www.youtube.com/watch?v=abc123",
      playerId,
      skill: "SPIKE",
      outcome: "POINT_WON",
    });
    const id = createRes.body.clip.id;

    const updateRes = await request(app)
      .patch(`/clips/${id}`)
      .send({ url: "https://www.youtube.com/watch?v=zzz999" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clip.thumbnailUrl).toBe("https://img.youtube.com/vi/zzz999/hqdefault.jpg");
  });

  it("leaves thumbnailUrl unchanged when url is not part of the update", async () => {
    const playerId = await createPlayer(app);
    const createRes = await request(app).post("/clips").send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://www.youtube.com/watch?v=abc123",
      playerId,
      skill: "SPIKE",
      outcome: "POINT_WON",
    });
    const id = createRes.body.clip.id;

    const updateRes = await request(app).patch(`/clips/${id}`).send({ outcome: "POINT_LOST" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clip.thumbnailUrl).toBe("https://img.youtube.com/vi/abc123/hqdefault.jpg");
  });

  it("does not recompute thumbnailUrl when url is resent unchanged", async () => {
    const realFetch = global.fetch;
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ thumbnail_url: "https://i.vimeocdn.com/video/123_640.jpg" }), { status: 200 })
    ) as jest.Mock;

    const playerId = await createPlayer(app);
    const createRes = await request(app).post("/clips").send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://vimeo.com/76979871",
      playerId,
      skill: "SPIKE",
      outcome: "POINT_WON",
    });
    const id = createRes.body.clip.id;
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // The web edit form always submits the full record, including url/sourceType,
    // even when the user only changed an unrelated field like outcome — so this
    // must not trigger a needless (and, for Vimeo, network-bound) recompute.
    const updateRes = await request(app).patch(`/clips/${id}`).send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://vimeo.com/76979871",
      outcome: "POINT_LOST",
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.clip.thumbnailUrl).toBe("https://i.vimeocdn.com/video/123_640.jpg");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    global.fetch = realFetch;
  });
});
