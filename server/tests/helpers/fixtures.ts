import request from "supertest";
import { Express } from "express";

export async function createPlayer(app: Express, name = "Jane Doe") {
  const res = await request(app).post("/players").send({ name });
  return res.body.player.id as string;
}

export async function createClip(app: Express, playerId: string, title: string) {
  const res = await request(app).post("/clips").send({
    title,
    sourceType: "LINK",
    url: `https://youtube.com/watch?v=${title.replace(/\s/g, "")}`,
    playerId,
    skill: "SPIKE",
    outcome: "POINT_WON",
  });
  return res.body.clip.id as string;
}
