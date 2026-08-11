import request from "supertest";

jest.mock("../src/lib/supabaseStorage", () => ({
  createSignedUploadUrl: jest.fn(async (path: string) => ({
    signedUrl: `https://fake.supabase.co/storage/v1/upload/${path}`,
    token: "fake-token",
    path,
  })),
  publicUrlFor: jest.fn(
    (path: string) => `https://fake.supabase.co/storage/v1/object/public/clips/${path}`
  ),
}));

import { createApp } from "../src/app";

describe("POST /uploads/sign", () => {
  it("returns a signed upload URL and public URL for a given file name", async () => {
    const app = createApp();
    const res = await request(app).post("/uploads/sign").send({ fileName: "match-clip.mp4" });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toContain("upload");
    expect(res.body.publicUrl).toContain("clips/");
    expect(res.body.path).toMatch(/\.mp4$/);
  });

  it("returns 400 when fileName is missing", async () => {
    const app = createApp();
    const res = await request(app).post("/uploads/sign").send({});
    expect(res.status).toBe(400);
  });
});
