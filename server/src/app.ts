import express, { Express } from "express";
import cors from "cors";
import { config } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import playersRoutes from "./routes/players.routes";
import clipsRoutes from "./routes/clips.routes";
import playlistsRoutes from "./routes/playlists.routes";
import shareRoutes from "./routes/share.routes";
import uploadsRoutes from "./routes/uploads.routes";
import aiRoutes from "./routes/ai.routes";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  // Scoped to the one route that actually sends large bodies (up to 9 base64
  // JPEG frames, capped at 2MB each in ai.routes.ts) — mounted before the
  // general parser below so it runs first for this path; body-parser skips
  // re-parsing a body it's already consumed, so the general parser below is
  // effectively a no-op for this route. Every other route keeps Express's
  // default (much smaller) limit.
  app.use("/ai/suggest-tags", express.json({ limit: "20mb" }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/players", playersRoutes);
  app.use("/clips", clipsRoutes);
  app.use("/playlists", playlistsRoutes);
  app.use("/share", shareRoutes);
  app.use("/uploads", uploadsRoutes);
  app.use("/ai", aiRoutes);

  app.use(errorHandler);

  return app;
}
