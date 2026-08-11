import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "./helpers/db";

const app = createApp();

async function createPlayer(name = "Jane Doe") {
  const res = await request(app).post("/players").send({ name });
  return res.body.player.id as string;
}

describe("Clips", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("creates a clip and rejects an unknown playerId", async () => {
    const playerId = await createPlayer();

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
    const playerA = await createPlayer("Jane Doe");
    const playerB = await createPlayer("Sam Lee");

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
    const playerId = await createPlayer();
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
});
