import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "./helpers/db";

const app = createApp();

describe("Players", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("creates and lists players", async () => {
    const createRes = await request(app)
      .post("/players")
      .send({ name: "Jane Doe", position: "Left Side", graduationYear: 2027 });

    expect(createRes.status).toBe(201);
    expect(createRes.body.player.name).toBe("Jane Doe");

    const listRes = await request(app).get("/players");
    expect(listRes.status).toBe(200);
    expect(listRes.body.players).toHaveLength(1);
  });

  it("returns 400 when name is missing", async () => {
    const res = await request(app).post("/players").send({ position: "Libero" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when position is not one of the fixed set of positions", async () => {
    const res = await request(app)
      .post("/players")
      .send({ name: "Jane Doe", position: "Outside Hitter" });
    expect(res.status).toBe(400);
  });

  it("gets, updates, and deletes a single player", async () => {
    const createRes = await request(app).post("/players").send({ name: "Jane Doe" });
    const id = createRes.body.player.id;

    const getRes = await request(app).get(`/players/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.player.name).toBe("Jane Doe");

    const updateRes = await request(app).patch(`/players/${id}`).send({ position: "Setter" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.player.position).toBe("Setter");

    const deleteRes = await request(app).delete(`/players/${id}`);
    expect(deleteRes.status).toBe(204);

    const afterDelete = await request(app).get(`/players/${id}`);
    expect(afterDelete.status).toBe(404);
  });

  it("clears an optional field by sending null", async () => {
    const createRes = await request(app).post("/players").send({ name: "Jane Doe", position: "Setter" });
    const id = createRes.body.player.id;

    const updateRes = await request(app).patch(`/players/${id}`).send({ position: null });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.player.position).toBeNull();
  });

  it("returns 409 when deleting a player who still has clips", async () => {
    const createRes = await request(app).post("/players").send({ name: "Jane Doe" });
    const id = createRes.body.player.id;

    await request(app).post("/clips").send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=abc",
      playerId: id,
      skill: "SPIKE",
      outcome: "POINT_WON",
    });

    const deleteRes = await request(app).delete(`/players/${id}`);
    expect(deleteRes.status).toBe(409);
  });
});

describe("GET /players/:id/stats", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("returns 404 for a player that doesn't exist", async () => {
    const res = await request(app).get("/players/does-not-exist/stats");
    expect(res.status).toBe(404);
  });

  it("returns zeroed stats for a player with no clips", async () => {
    const createRes = await request(app).post("/players").send({ name: "Jane Doe" });
    const id = createRes.body.player.id;

    const res = await request(app).get(`/players/${id}/stats`);

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      totalClips: 0,
      pointWonPct: null,
      pointLostPct: null,
      noPointPct: null,
      attackEfficiency: null,
      bySkill: [],
    });
  });

  it("computes overall and per-skill percentages, and attack efficiency from SPIKE clips", async () => {
    const createRes = await request(app).post("/players").send({ name: "Jane Doe" });
    const id = createRes.body.player.id;

    const clip = (skill: string, outcome: string) =>
      request(app)
        .post("/clips")
        .send({
          title: `${skill} ${outcome}`,
          sourceType: "LINK",
          url: "https://youtube.com/watch?v=abc",
          playerId: id,
          skill,
          outcome,
        });

    await clip("SPIKE", "POINT_WON");
    await clip("SPIKE", "POINT_WON");
    await clip("SPIKE", "POINT_LOST");
    await clip("SPIKE", "NO_POINT");
    await clip("ACE", "POINT_WON");

    const res = await request(app).get(`/players/${id}/stats`);

    expect(res.status).toBe(200);
    expect(res.body.stats.totalClips).toBe(5);
    expect(res.body.stats.pointWonPct).toBe(60);
    expect(res.body.stats.pointLostPct).toBe(20);
    expect(res.body.stats.noPointPct).toBe(20);
    // (2 won - 1 lost) / 4 spike clips = 0.25
    expect(res.body.stats.attackEfficiency).toBe(0.25);

    const spikeRow = res.body.stats.bySkill.find((s: { skill: string }) => s.skill === "SPIKE");
    expect(spikeRow).toEqual({ skill: "SPIKE", count: 4, pointWonPct: 50, pointLostPct: 25, noPointPct: 25 });

    const aceRow = res.body.stats.bySkill.find((s: { skill: string }) => s.skill === "ACE");
    expect(aceRow).toEqual({ skill: "ACE", count: 1, pointWonPct: 100, pointLostPct: 0, noPointPct: 0 });
  });
});
