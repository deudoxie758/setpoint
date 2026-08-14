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
