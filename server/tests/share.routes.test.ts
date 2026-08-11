import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "./helpers/db";

const app = createApp();

describe("GET /share/:token", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("returns the playlist's ordered clips for a valid token", async () => {
    const playerRes = await request(app).post("/players").send({ name: "Jane Doe" });
    const playerId = playerRes.body.player.id;

    const clipRes = await request(app).post("/clips").send({
      title: "Cross-court kill",
      sourceType: "LINK",
      url: "https://youtube.com/watch?v=abc",
      playerId,
      skill: "SPIKE",
      outcome: "POINT_WON",
    });
    const clipId = clipRes.body.clip.id;

    const playlistRes = await request(app)
      .post("/playlists")
      .send({ name: "Recruiting Reel", description: "Best plays" });
    const playlist = playlistRes.body.playlist;

    await request(app).post(`/playlists/${playlist.id}/clips`).send({ clipIds: [clipId] });

    const shareRes = await request(app).get(`/share/${playlist.shareToken}`);
    expect(shareRes.status).toBe(200);
    expect(shareRes.body.playlist.name).toBe("Recruiting Reel");
    expect(shareRes.body.playlist.clips).toHaveLength(1);
    expect(shareRes.body.playlist.clips[0].title).toBe("Cross-court kill");
    expect(shareRes.body.playlist.id).toBeUndefined();
  });

  it("returns 404 for an unknown token", async () => {
    const res = await request(app).get("/share/not-a-real-token");
    expect(res.status).toBe(404);
  });
});
