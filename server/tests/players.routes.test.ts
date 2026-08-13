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
      .send({ name: "Jane Doe", position: "Outside Hitter", graduationYear: 2027 });

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
