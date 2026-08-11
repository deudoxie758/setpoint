import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "./helpers/db";
import { createPlayer, createClip } from "./helpers/fixtures";

const app = createApp();

describe("Playlists", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("creates a playlist with a unique share token", async () => {
    const res = await request(app).post("/playlists").send({ name: "Recruiting Reel" });
    expect(res.status).toBe(201);
    expect(res.body.playlist.name).toBe("Recruiting Reel");
    expect(res.body.playlist.shareToken).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("adds clips, reorders them, and removes one", async () => {
    const playerId = await createPlayer(app);
    const clipA = await createClip(app, playerId, "Clip A");
    const clipB = await createClip(app, playerId, "Clip B");
    const clipC = await createClip(app, playerId, "Clip C");

    const playlistRes = await request(app).post("/playlists").send({ name: "Recruiting Reel" });
    const playlistId = playlistRes.body.playlist.id;

    const addRes = await request(app)
      .post(`/playlists/${playlistId}/clips`)
      .send({ clipIds: [clipA, clipB, clipC] });
    expect(addRes.status).toBe(201);
    expect(addRes.body.playlist.clips.map((pc: any) => pc.clip.id)).toEqual([clipA, clipB, clipC]);

    const reorderRes = await request(app)
      .patch(`/playlists/${playlistId}/clips/reorder`)
      .send({ clipIds: [clipC, clipA, clipB] });
    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.playlist.clips.map((pc: any) => pc.clip.id)).toEqual([clipC, clipA, clipB]);

    const removeRes = await request(app).delete(`/playlists/${playlistId}/clips/${clipA}`);
    expect(removeRes.status).toBe(204);

    const getRes = await request(app).get(`/playlists/${playlistId}`);
    expect(getRes.body.playlist.clips.map((pc: any) => pc.clip.id)).toEqual([clipC, clipB]);
  });

  it("returns 400 when adding a clipId that doesn't reference an existing clip", async () => {
    const playlistRes = await request(app).post("/playlists").send({ name: "Recruiting Reel" });
    const playlistId = playlistRes.body.playlist.id;

    const addRes = await request(app)
      .post(`/playlists/${playlistId}/clips`)
      .send({ clipIds: ["does-not-exist"] });
    expect(addRes.status).toBe(400);
  });

  it("returns 400 when reorder is given a partial clip list", async () => {
    const playerId = await createPlayer(app);
    const clipA = await createClip(app, playerId, "Clip A");
    const clipB = await createClip(app, playerId, "Clip B");

    const playlistRes = await request(app).post("/playlists").send({ name: "Recruiting Reel" });
    const playlistId = playlistRes.body.playlist.id;

    await request(app).post(`/playlists/${playlistId}/clips`).send({ clipIds: [clipA, clipB] });

    const reorderRes = await request(app)
      .patch(`/playlists/${playlistId}/clips/reorder`)
      .send({ clipIds: [clipA] });
    expect(reorderRes.status).toBe(400);
  });

  it("returns 404 for a playlist that doesn't exist", async () => {
    const res = await request(app).get("/playlists/does-not-exist");
    expect(res.status).toBe(404);
  });

  it("updates and deletes a playlist", async () => {
    const playlistRes = await request(app).post("/playlists").send({ name: "Recruiting Reel" });
    const id = playlistRes.body.playlist.id;

    const updateRes = await request(app).patch(`/playlists/${id}`).send({ name: "Updated Name" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.playlist.name).toBe("Updated Name");

    const deleteRes = await request(app).delete(`/playlists/${id}`);
    expect(deleteRes.status).toBe(204);

    const afterDelete = await request(app).get(`/playlists/${id}`);
    expect(afterDelete.status).toBe(404);
  });
});
