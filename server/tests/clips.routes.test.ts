import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "./helpers/db";
import { createPlayer } from "./helpers/fixtures";

const app = createApp();

describe("Clips", () => {
  afterEach(async () => {
    await resetDb();
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
});
