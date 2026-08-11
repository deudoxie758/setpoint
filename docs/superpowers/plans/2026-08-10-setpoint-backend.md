# SetPoint Backend (server/) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SetPoint Express + TypeScript API — players, clips (with filtering), playlists (with reorder and public share links), and Supabase Storage-backed clip uploads — fully testable without the frontend.

**Architecture:** Express app (`createApp()` factory) with Prisma/Postgres for data, mounted route modules per resource, Zod for input validation, a shared error-handling middleware that maps validation and Prisma errors to HTTP status codes. Follows the same conventions as the sibling Docket project's `server/` (Jest + Supertest + ts-jest, `tests/<resource>.routes.test.ts` naming, `createApp()`/`resetDb()` helpers) for consistency across the developer's portfolio.

**Tech Stack:** Node/TypeScript, Express, Prisma, PostgreSQL (local via Docker for dev/test, Supabase in production), Zod, `@supabase/supabase-js` (Storage only, service-role key), Jest + Supertest + ts-jest.

## Global Constraints

- No authentication anywhere in this API — single implicit workspace (per spec's "No authentication" decision).
- Free-tier infrastructure only: local Postgres via Docker for dev/test, Supabase (Postgres + Storage) in production — no paid services.
- Skill values are a fixed enum: `SERVE | ACE | SPIKE | BLOCK | DIG | SET | ASSIST` (per spec's "Skill field" decision) — not free text.
- Outcome values are a fixed enum: `POINT_WON | POINT_LOST | NO_POINT`.
- Playlists must support both manual clip-by-clip curation and bulk-adding a set of clip IDs at once (per spec's "Playlists" decision) — the same `POST /playlists/:id/clips` endpoint serves both, since both are "add these clip IDs to this playlist."
- A playlist's public share view is reached via an unguessable `shareToken`, never its internal `id`.
- Every route module follows the existing Docket pattern: async handlers wrapped in try/catch calling `next(err)`, with `errorHandler` doing all status-code translation — no per-route status-code logic duplicated across files.

---

## File Structure

```
server/
  package.json
  tsconfig.json
  tsconfig.build.json
  jest.config.js
  .env.example
  prisma/
    schema.prisma
  src/
    server.ts                    # entrypoint, listens on config.port
    app.ts                       # createApp(): mounts all routes + error handler
    config/
      env.ts                     # typed env access, throws on missing required vars
    db/
      prisma.ts                  # shared PrismaClient singleton
    middleware/
      errorHandler.ts            # ApiError class + errorHandler (Zod/Prisma-aware)
    lib/
      shareToken.ts               # generateShareToken()
      supabaseStorage.ts          # createSignedUploadUrl(), publicUrlFor()
    routes/
      players.routes.ts
      clips.routes.ts
      playlists.routes.ts
      share.routes.ts
      uploads.routes.ts
  tests/
    setup.ts
    helpers/
      db.ts                      # resetDb()
    health.test.ts
    prisma.test.ts
    shareToken.test.ts
    players.routes.test.ts
    clips.routes.test.ts
    playlists.routes.test.ts
    share.routes.test.ts
    uploads.routes.test.ts

docker-compose.yml                # repo root: local Postgres for dev/test
README.md                         # repo root: setup + manual deploy steps (updated in Task 9)
```

---

### Task 1: Project scaffold, config, error handling, health check

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/tsconfig.build.json`
- Create: `server/jest.config.js`
- Create: `server/.env.example`
- Create: `server/src/config/env.ts`
- Create: `server/src/middleware/errorHandler.ts`
- Create: `server/src/app.ts`
- Create: `server/src/server.ts`
- Create: `server/tests/setup.ts`
- Test: `server/tests/health.test.ts`
- Create: `docker-compose.yml` (repo root)

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `createApp(): Express` from `src/app.ts` — every later route task imports this to mount routes and every test file uses it with Supertest.
  - `config: { port: number; databaseUrl: string; supabaseUrl: string; supabaseServiceRoleKey: string; clientOrigin: string; nodeEnv: string }` from `src/config/env.ts`.
  - `ApiError` class (`new ApiError(statusCode: number, message: string)`) and `errorHandler` middleware from `src/middleware/errorHandler.ts` — later route tasks `throw new ApiError(...)` for domain errors (e.g. 404s) and rely on `errorHandler` to turn `ZodError` into 400 and Prisma's `P2025` ("record not found") into 404 automatically.

- [ ] **Step 1: Create `docker-compose.yml` at the repo root for local Postgres**

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: setpoint
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
```

Run: `docker compose up -d`
Expected: `postgres` container starts and reports healthy (`docker compose ps` shows `healthy`).

- [ ] **Step 2: Create `server/package.json`**

```json
{
  "name": "setpoint-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "test": "jest --runInBand",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "@supabase/supabase-js": "^2.45.4",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.13",
    "@types/node": "^20.16.10",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^5.20.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.6.2"
  }
}
```

Run: `cd server && npm install`
Expected: install completes with no errors.

- [ ] **Step 3: Create `server/tsconfig.json` and `server/tsconfig.build.json`**

`server/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src", "tests"],
  "exclude": ["node_modules", "dist"]
}
```

`server/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create `server/.env.example` and a local `server/.env` copy**

`server/.env.example`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/setpoint"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
CLIENT_ORIGIN="http://localhost:3000"
PORT=4000
NODE_ENV=development
```

Run: `cp server/.env.example server/.env`
Expected: `server/.env` exists (it's gitignored — see Task 9 for the root `.gitignore`).

- [ ] **Step 5: Create `server/src/config/env.ts`**

```typescript
import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: required("DATABASE_URL"),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
};
```

`supabaseUrl`/`supabaseServiceRoleKey` are intentionally not `required()` — the app must boot for local dev/testing before a real Supabase project exists (Task 8's upload tests mock the Supabase client entirely).

- [ ] **Step 6: Create `server/src/middleware/errorHandler.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Invalid request", details: err.flatten() });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return res.status(404).json({ error: "Not found" });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
```

- [ ] **Step 7: Write the failing health test**

`server/tests/health.test.ts`:
```typescript
import request from "supertest";
import { createApp } from "../src/app";

describe("GET /health", () => {
  it("returns status ok", async () => {
    const app = createApp();
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
```

`server/tests/setup.ts`:
```typescript
import dotenv from "dotenv";

dotenv.config();
```

`server/jest.config.js`:
```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
};
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd server && npx jest tests/health.test.ts`
Expected: FAIL — `Cannot find module '../src/app'` (it doesn't exist yet).

- [ ] **Step 9: Create `server/src/app.ts` with just the health route**

```typescript
import express, { Express } from "express";
import cors from "cors";
import { config } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 10: Create `server/src/server.ts`**

```typescript
import { createApp } from "./app";
import { config } from "./config/env";

const app = createApp();

app.listen(config.port, () => {
  console.log(`SetPoint API listening on port ${config.port}`);
});
```

- [ ] **Step 11: Run test to verify it passes**

Run: `cd server && npx jest tests/health.test.ts`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add docker-compose.yml server/package.json server/package-lock.json server/tsconfig.json server/tsconfig.build.json server/jest.config.js server/.env.example server/src server/tests
git commit -m "feat(server): scaffold Express app with health check and error handling"
```

---

### Task 2: Prisma schema and database client

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/src/db/prisma.ts`
- Create: `server/tests/helpers/db.ts`
- Test: `server/tests/prisma.test.ts`
- Modify: `server/tests/setup.ts` (disconnect Prisma after all tests)

**Interfaces:**
- Consumes: `config.databaseUrl` from Task 1's `src/config/env.ts`.
- Produces:
  - `prisma: PrismaClient` from `src/db/prisma.ts` — every later route module imports this.
  - `resetDb(): Promise<void>` from `tests/helpers/db.ts` — every later route test file calls this in `afterEach`.
  - Prisma models `Player`, `Clip`, `Playlist`, `PlaylistClip` and enums `SourceType`, `Skill`, `Outcome` — later tasks import these enum types from `@prisma/client`.

- [ ] **Step 1: Create `server/prisma/schema.prisma`**

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SourceType {
  LINK
  UPLOAD
}

enum Skill {
  SERVE
  ACE
  SPIKE
  BLOCK
  DIG
  SET
  ASSIST
}

enum Outcome {
  POINT_WON
  POINT_LOST
  NO_POINT
}

model Player {
  id             String   @id @default(cuid())
  name           String
  position       String?
  graduationYear Int?
  clips          Clip[]
  createdAt      DateTime @default(now())
}

model Clip {
  id            String         @id @default(cuid())
  title         String
  sourceType    SourceType
  url           String
  playerId      String
  player        Player         @relation(fields: [playerId], references: [id])
  skill         Skill
  outcome       Outcome
  opponent      String?
  matchDate     DateTime?
  notes         String?
  playlistClips PlaylistClip[]
  createdAt     DateTime       @default(now())
}

model Playlist {
  id          String         @id @default(cuid())
  name        String
  description String?
  shareToken  String         @unique
  clips       PlaylistClip[]
  createdAt   DateTime       @default(now())
}

model PlaylistClip {
  playlistId String
  playlist   Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  clipId     String
  clip       Clip     @relation(fields: [clipId], references: [id], onDelete: Cascade)
  position   Int

  @@id([playlistId, clipId])
}
```

- [ ] **Step 2: Run the initial migration against local Postgres**

Run: `cd server && npx prisma migrate dev --name init`
Expected: migration applies successfully, `server/prisma/migrations/<timestamp>_init/` is created, Prisma Client is generated with no errors.

- [ ] **Step 3: Create `server/src/db/prisma.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = global.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}
```

- [ ] **Step 4: Update `server/tests/setup.ts` to disconnect Prisma after all tests**

```typescript
import dotenv from "dotenv";

dotenv.config();

import { prisma } from "../src/db/prisma";

afterAll(async () => {
  await prisma.$disconnect();
});
```

- [ ] **Step 5: Create `server/tests/helpers/db.ts`**

```typescript
import { prisma } from "../../src/db/prisma";

export async function resetDb() {
  await prisma.playlistClip.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.clip.deleteMany();
  await prisma.player.deleteMany();
}
```

- [ ] **Step 6: Write the failing sanity test**

`server/tests/prisma.test.ts`:
```typescript
import { prisma } from "../src/db/prisma";
import { resetDb } from "./helpers/db";

describe("Prisma schema", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("can create and read a Player", async () => {
    const player = await prisma.player.create({
      data: { name: "Jane Doe", position: "Outside Hitter", graduationYear: 2027 },
    });

    const found = await prisma.player.findUnique({ where: { id: player.id } });

    expect(found?.name).toBe("Jane Doe");
  });

  it("cascades PlaylistClip rows when a Playlist is deleted", async () => {
    const player = await prisma.player.create({ data: { name: "Jane Doe" } });
    const clip = await prisma.clip.create({
      data: {
        title: "Cross-court kill",
        sourceType: "LINK",
        url: "https://youtube.com/watch?v=abc",
        playerId: player.id,
        skill: "SPIKE",
        outcome: "POINT_WON",
      },
    });
    const playlist = await prisma.playlist.create({
      data: { name: "Recruiting Reel", shareToken: "test-token-1" },
    });
    await prisma.playlistClip.create({
      data: { playlistId: playlist.id, clipId: clip.id, position: 0 },
    });

    await prisma.playlist.delete({ where: { id: playlist.id } });

    const remaining = await prisma.playlistClip.findMany({ where: { playlistId: playlist.id } });
    expect(remaining).toHaveLength(0);
  });
});
```

This test file was created fresh in this task (not present before), so there's no separate "run to verify it fails" step — go straight to running it once the schema/client exist.

- [ ] **Step 7: Run test to verify it passes**

Run: `cd server && npx jest tests/prisma.test.ts tests/health.test.ts`
Expected: PASS (both files)

- [ ] **Step 8: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/prisma server/src/db server/tests/helpers server/tests/prisma.test.ts server/tests/setup.ts
git commit -m "feat(server): add Prisma schema for players, clips, and playlists"
```

---

### Task 3: Share token generator

**Files:**
- Create: `server/src/lib/shareToken.ts`
- Test: `server/tests/shareToken.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `generateShareToken(): string` from `src/lib/shareToken.ts` — Task 6 (playlist creation) calls this to populate `Playlist.shareToken`.

- [ ] **Step 1: Write the failing test**

`server/tests/shareToken.test.ts`:
```typescript
import { generateShareToken } from "../src/lib/shareToken";

describe("generateShareToken", () => {
  it("returns a URL-safe string with no padding or slashes", () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(10);
  });

  it("returns a different token on each call", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/shareToken.test.ts`
Expected: FAIL — `Cannot find module '../src/lib/shareToken'`

- [ ] **Step 3: Create `server/src/lib/shareToken.ts`**

```typescript
import { randomBytes } from "crypto";

export function generateShareToken(): string {
  return randomBytes(9).toString("base64url");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest tests/shareToken.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/lib/shareToken.ts server/tests/shareToken.test.ts
git commit -m "feat(server): add unguessable share token generator"
```

---

### Task 4: Players CRUD routes

**Files:**
- Create: `server/src/routes/players.routes.ts`
- Modify: `server/src/app.ts` (mount `/players`)
- Test: `server/tests/players.routes.test.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `ApiError`/`errorHandler` (Task 1), `createApp()` (Task 1, modified here).
- Produces: `POST /players`, `GET /players`, `GET /players/:id`, `PATCH /players/:id`, `DELETE /players/:id` — Task 5 (clips) relies on `GET /players/:id` existing conceptually (a clip's `playerId` must reference a real player) and reuses the same Zod-validation-then-Prisma-call pattern.

- [ ] **Step 1: Write the failing test**

`server/tests/players.routes.test.ts`:
```typescript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/players.routes.test.ts`
Expected: FAIL — 404s on every request (no `/players` route mounted yet).

- [ ] **Step 3: Create `server/src/routes/players.routes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

const playerInput = z.object({
  name: z.string().min(1),
  position: z.string().optional(),
  graduationYear: z.number().int().optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const data = playerInput.parse(req.body);
    const player = await prisma.player.create({ data });
    res.status(201).json({ player });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const players = await prisma.player.findMany({ orderBy: { name: "asc" } });
    res.json({ players });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) throw new ApiError(404, "Player not found");
    res.json({ player });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const data = playerInput.partial().parse(req.body);
    const player = await prisma.player.update({ where: { id: req.params.id }, data });
    res.json({ player });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.player.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: Mount the router in `server/src/app.ts`**

```typescript
import express, { Express } from "express";
import cors from "cors";
import { config } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import playersRoutes from "./routes/players.routes";

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/players", playersRoutes);

  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/players.routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/routes/players.routes.ts server/src/app.ts server/tests/players.routes.test.ts
git commit -m "feat(server): add players CRUD routes"
```

---

### Task 5: Clips CRUD + filtering routes

**Files:**
- Create: `server/src/routes/clips.routes.ts`
- Modify: `server/src/app.ts` (mount `/clips`)
- Test: `server/tests/clips.routes.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError` (Task 1/2), `Skill`/`Outcome`/`SourceType` enums from `@prisma/client` (Task 2), players routes existing so tests can create a player to attach clips to (Task 4).
- Produces: `POST /clips`, `GET /clips` (supports `?playerId=&skill=&outcome=&opponent=` query filters), `GET /clips/:id`, `PATCH /clips/:id`, `DELETE /clips/:id` — Task 6 (playlists) uses `Clip` records (created via this route in tests) as the things playlists reference by `clipId`.

- [ ] **Step 1: Write the failing test**

`server/tests/clips.routes.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/clips.routes.test.ts`
Expected: FAIL — 404s on every `/clips` request.

- [ ] **Step 3: Create `server/src/routes/clips.routes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { Skill, Outcome, SourceType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

const clipInput = z.object({
  title: z.string().min(1),
  sourceType: z.nativeEnum(SourceType),
  url: z.string().url(),
  playerId: z.string().min(1),
  skill: z.nativeEnum(Skill),
  outcome: z.nativeEnum(Outcome),
  opponent: z.string().optional(),
  matchDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const data = clipInput.parse(req.body);
    const player = await prisma.player.findUnique({ where: { id: data.playerId } });
    if (!player) throw new ApiError(400, "playerId does not reference an existing player");
    const clip = await prisma.clip.create({ data });
    res.status(201).json({ clip });
  } catch (err) {
    next(err);
  }
});

const listQuery = z.object({
  playerId: z.string().optional(),
  skill: z.nativeEnum(Skill).optional(),
  outcome: z.nativeEnum(Outcome).optional(),
  opponent: z.string().optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const filters = listQuery.parse(req.query);
    const clips = await prisma.clip.findMany({
      where: {
        playerId: filters.playerId,
        skill: filters.skill,
        outcome: filters.outcome,
        opponent: filters.opponent ? { contains: filters.opponent, mode: "insensitive" } : undefined,
      },
      include: { player: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ clips });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const clip = await prisma.clip.findUnique({
      where: { id: req.params.id },
      include: { player: true },
    });
    if (!clip) throw new ApiError(404, "Clip not found");
    res.json({ clip });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const data = clipInput.partial().parse(req.body);
    const clip = await prisma.clip.update({ where: { id: req.params.id }, data });
    res.json({ clip });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.clip.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: Mount the router in `server/src/app.ts`**

Add to `server/src/app.ts`:
```typescript
import clipsRoutes from "./routes/clips.routes";
// ...
app.use("/clips", clipsRoutes);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/clips.routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/routes/clips.routes.ts server/src/app.ts server/tests/clips.routes.test.ts
git commit -m "feat(server): add clips CRUD routes with filtering"
```

---

### Task 6: Playlists routes (CRUD, add/remove clips, reorder)

**Files:**
- Create: `server/src/routes/playlists.routes.ts`
- Modify: `server/src/app.ts` (mount `/playlists`)
- Test: `server/tests/playlists.routes.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError` (Task 1/2), `generateShareToken()` (Task 3), players/clips routes (Task 4/5, used in tests to set up fixtures).
- Produces: `POST /playlists`, `GET /playlists`, `GET /playlists/:id` (ordered clips included), `PATCH /playlists/:id`, `DELETE /playlists/:id`, `POST /playlists/:id/clips` (body `{ clipIds: string[] }`, appends — used for both single-clip manual add and bulk filter-based add), `PATCH /playlists/:id/clips/reorder` (body `{ clipIds: string[] }`, full reorder), `DELETE /playlists/:id/clips/:clipId`. Task 7 (share) relies on `Playlist.shareToken` being set on creation.

- [ ] **Step 1: Write the failing test**

`server/tests/playlists.routes.test.ts`:
```typescript
import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "./helpers/db";

const app = createApp();

async function createPlayer(name = "Jane Doe") {
  const res = await request(app).post("/players").send({ name });
  return res.body.player.id as string;
}

async function createClip(playerId: string, title: string) {
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
    const playerId = await createPlayer();
    const clipA = await createClip(playerId, "Clip A");
    const clipB = await createClip(playerId, "Clip B");
    const clipC = await createClip(playerId, "Clip C");

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/playlists.routes.test.ts`
Expected: FAIL — 404s on every `/playlists` request.

- [ ] **Step 3: Create `server/src/routes/playlists.routes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";
import { generateShareToken } from "../lib/shareToken";

const router = Router();

const playlistInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

function withOrderedClips() {
  return {
    clips: {
      orderBy: { position: "asc" as const },
      include: { clip: { include: { player: true } } },
    },
  };
}

router.post("/", async (req, res, next) => {
  try {
    const data = playlistInput.parse(req.body);
    const playlist = await prisma.playlist.create({
      data: { ...data, shareToken: generateShareToken() },
    });
    res.status(201).json({ playlist });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const playlists = await prisma.playlist.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ playlists });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
      include: withOrderedClips(),
    });
    if (!playlist) throw new ApiError(404, "Playlist not found");
    res.json({ playlist });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const data = playlistInput.partial().parse(req.body);
    const playlist = await prisma.playlist.update({ where: { id: req.params.id }, data });
    res.json({ playlist });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.playlist.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const addClipsInput = z.object({ clipIds: z.array(z.string().min(1)).min(1) });

router.post("/:id/clips", async (req, res, next) => {
  try {
    const { clipIds } = addClipsInput.parse(req.body);
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw new ApiError(404, "Playlist not found");

    const last = await prisma.playlistClip.findFirst({
      where: { playlistId: playlist.id },
      orderBy: { position: "desc" },
    });
    const nextPosition = last ? last.position + 1 : 0;

    await prisma.playlistClip.createMany({
      data: clipIds.map((clipId, i) => ({
        playlistId: playlist.id,
        clipId,
        position: nextPosition + i,
      })),
      skipDuplicates: true,
    });

    const updated = await prisma.playlist.findUnique({
      where: { id: playlist.id },
      include: withOrderedClips(),
    });
    res.status(201).json({ playlist: updated });
  } catch (err) {
    next(err);
  }
});

const reorderInput = z.object({ clipIds: z.array(z.string().min(1)) });

router.patch("/:id/clips/reorder", async (req, res, next) => {
  try {
    const { clipIds } = reorderInput.parse(req.body);
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) throw new ApiError(404, "Playlist not found");

    await prisma.$transaction(
      clipIds.map((clipId, position) =>
        prisma.playlistClip.update({
          where: { playlistId_clipId: { playlistId: playlist.id, clipId } },
          data: { position },
        })
      )
    );

    const updated = await prisma.playlist.findUnique({
      where: { id: playlist.id },
      include: withOrderedClips(),
    });
    res.json({ playlist: updated });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/clips/:clipId", async (req, res, next) => {
  try {
    await prisma.playlistClip.delete({
      where: {
        playlistId_clipId: { playlistId: req.params.id, clipId: req.params.clipId },
      },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: Mount the router in `server/src/app.ts`**

Add to `server/src/app.ts`:
```typescript
import playlistsRoutes from "./routes/playlists.routes";
// ...
app.use("/playlists", playlistsRoutes);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/playlists.routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/routes/playlists.routes.ts server/src/app.ts server/tests/playlists.routes.test.ts
git commit -m "feat(server): add playlist routes with clip add/remove/reorder"
```

---

### Task 7: Public share route

**Files:**
- Create: `server/src/routes/share.routes.ts`
- Modify: `server/src/app.ts` (mount `/share`)
- Test: `server/tests/share.routes.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ApiError` (Task 1/2), playlists/clips/players routes (Task 4-6, used in tests to set up fixtures).
- Produces: `GET /share/:token` → `{ playlist: { name, description, clips: Clip[] } }` or 404. This is the endpoint the frontend's `/share/[token]` page (planned separately) will call — note it takes a `shareToken`, never an internal playlist `id`.

- [ ] **Step 1: Write the failing test**

`server/tests/share.routes.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest tests/share.routes.test.ts`
Expected: FAIL — 404 on `/share/...` (route not mounted yet, though the 404-for-unknown-token case would coincidentally already look like a pass; the first test's 200 assertion fails, confirming the route doesn't exist).

- [ ] **Step 3: Create `server/src/routes/share.routes.ts`**

```typescript
import { Router } from "express";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";

const router = Router();

router.get("/:token", async (req, res, next) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { shareToken: req.params.token },
      include: {
        clips: {
          orderBy: { position: "asc" },
          include: { clip: { include: { player: true } } },
        },
      },
    });
    if (!playlist) throw new ApiError(404, "This playlist link is no longer valid");

    res.json({
      playlist: {
        name: playlist.name,
        description: playlist.description,
        clips: playlist.clips.map((pc) => pc.clip),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 4: Mount the router in `server/src/app.ts`**

Add to `server/src/app.ts`:
```typescript
import shareRoutes from "./routes/share.routes";
// ...
app.use("/share", shareRoutes);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest tests/share.routes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/routes/share.routes.ts server/src/app.ts server/tests/share.routes.test.ts
git commit -m "feat(server): add public read-only share route"
```

---

### Task 8: Upload signed-URL route

**Files:**
- Create: `server/src/lib/supabaseStorage.ts`
- Create: `server/src/routes/uploads.routes.ts`
- Modify: `server/src/app.ts` (mount `/uploads`)
- Test: `server/tests/uploads.routes.test.ts`

**Interfaces:**
- Consumes: `config.supabaseUrl`/`config.supabaseServiceRoleKey` (Task 1).
- Produces: `POST /uploads/sign` (body `{ fileName: string }`) → `{ uploadUrl, token, path, publicUrl }`. This is what the frontend's clip-upload form (planned separately) will call to get a URL to PUT the video file directly to Supabase Storage, then save `publicUrl` as the `Clip.url` via `POST /clips` with `sourceType: "UPLOAD"`.

- [ ] **Step 1: Create `server/src/lib/supabaseStorage.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";
import { config } from "../config/env";

export const CLIPS_BUCKET = "clips";

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);

export async function createSignedUploadUrl(path: string) {
  const { data, error } = await supabase.storage.from(CLIPS_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return data;
}

export function publicUrlFor(path: string) {
  const { data } = supabase.storage.from(CLIPS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
```

This file talks to a real Supabase project and is never exercised directly in tests — Step 2 mocks it at the module boundary so `POST /uploads/sign` can be tested without live Supabase credentials.

- [ ] **Step 2: Write the failing test (mocking `supabaseStorage`)**

`server/tests/uploads.routes.test.ts`:
```typescript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx jest tests/uploads.routes.test.ts`
Expected: FAIL — 404 on `/uploads/sign` (route not mounted yet).

- [ ] **Step 4: Create `server/src/routes/uploads.routes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createSignedUploadUrl, publicUrlFor } from "../lib/supabaseStorage";

const router = Router();

const signInput = z.object({
  fileName: z.string().min(1),
});

router.post("/sign", async (req, res, next) => {
  try {
    const { fileName } = signInput.parse(req.body);
    const ext = fileName.includes(".") ? fileName.split(".").pop() : "mp4";
    const path = `${randomUUID()}.${ext}`;

    const { signedUrl, token } = await createSignedUploadUrl(path);

    res.json({ uploadUrl: signedUrl, token, path, publicUrl: publicUrlFor(path) });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 5: Mount the router in `server/src/app.ts`**

Add to `server/src/app.ts`:
```typescript
import uploadsRoutes from "./routes/uploads.routes";
// ...
app.use("/uploads", uploadsRoutes);
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx jest tests/uploads.routes.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full test suite**

Run: `cd server && npm test`
Expected: PASS — all test files (health, prisma, shareToken, players, clips, playlists, share, uploads).

- [ ] **Step 8: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/lib/supabaseStorage.ts server/src/routes/uploads.routes.ts server/src/app.ts server/tests/uploads.routes.test.ts
git commit -m "feat(server): add Supabase Storage signed upload URL route"
```

---

### Task 9: Root .gitignore, README, and manual setup notes

**Files:**
- Create: `.gitignore` (repo root — verify it already covers `server/.env`, `node_modules/`; it was created in an earlier session, see Step 1)
- Create: `README.md` (repo root)

**Interfaces:**
- Consumes: nothing new — this documents the completed backend for a developer (or the next agent building the frontend plan) who has zero context.
- Produces: nothing consumed by code; the "Manual setup steps" section is what the user must do by hand (create a real Supabase project) before the app works against production.

- [ ] **Step 1: Confirm `.gitignore` covers backend artifacts**

Read `.gitignore` at the repo root. It should already contain `CLAUDE.md`, `DECISIONS.md`, `node_modules/`, `.env`, `.env.local`, `dist/`, `build/`, `.next/`, `.DS_Store` (created in an earlier session). If `server/.env` isn't covered by the `.env` pattern, add `server/.env` explicitly.

Run: `git check-ignore server/.env`
Expected: prints `server/.env` (confirms it's ignored).

- [ ] **Step 2: Write `README.md`**

```markdown
# SetPoint

Volleyball highlight clip library — link or upload match clips, tag them with player/skill/outcome metadata, and organize them into shareable, filterable playlists.

## Backend (`server/`)

### Local setup

1. `docker compose up -d` — starts local Postgres on `localhost:5432`.
2. `cd server && npm install`
3. `cp .env.example .env` and fill in `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` once you've created a Supabase project (see below). These can stay blank for local dev/testing — only the real upload flow needs them.
4. `npm run prisma:migrate` — applies the schema to your local Postgres.
5. `npm test` — runs the full test suite.
6. `npm run dev` — starts the API on `http://localhost:4000`.

### Manual setup steps (not automatable — require your own account/credentials)

- **Create a free Supabase project** at supabase.com. Copy the project's Postgres connection string into `DATABASE_URL` for production, and the project URL + `service_role` key into `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
- **Create a public Storage bucket named `clips`** in the Supabase dashboard (Storage → New bucket → public).
- Supabase free-tier projects pause after 7 days of inactivity — un-pause from the dashboard before a demo if it's been a while.
- **Deploy `server/`** to a free-tier host (Render or Fly) with the same env vars as `.env.example`, pointed at your real Supabase `DATABASE_URL`.

## Frontend (`web/`)

Not yet built — see `docs/superpowers/plans/` for the frontend implementation plan once it exists.

## Design docs

- `docs/superpowers/specs/2026-08-10-setpoint-design.md` — full design spec.
- `docs/superpowers/plans/` — implementation plans.
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add README.md .gitignore
git commit -m "docs: add backend setup README"
git push
```
