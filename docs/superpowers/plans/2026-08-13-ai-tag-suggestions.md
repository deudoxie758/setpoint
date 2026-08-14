# AI Tag Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user pre-fill a clip's `skill`/`outcome` fields on the Upload-mode clip form by sampling frames from the selected video and asking Claude Haiku 4.5 to classify them, with the suggestion clearly flagged as AI-generated and requiring user confirmation before save.

**Architecture:** Client-side frame sampling (hidden `<video>`+`<canvas>`, no upload needed) → `POST /ai/suggest-tags` → Claude Haiku 4.5 tool-use call constrained to this app's `Skill`/`Outcome` enums → zod-validated response → pre-filled form fields with a visible confidence caption. A companion `GET /ai/status` lets the frontend hide the feature entirely when no API key is configured, mirroring how this app already treats optional Supabase config.

**Tech Stack:** `@anthropic-ai/sdk` (new backend dependency), existing Express/zod/Prisma backend, existing Next.js/TanStack Query/react-hook-form frontend.

## Global Constraints

- Full design spec: `docs/superpowers/specs/2026-08-13-ai-tag-suggestions-design.md` — read it if anything below is ambiguous.
- `Skill`/`Outcome` enum values on the backend come from `@prisma/client` (see `server/prisma/schema.prisma`); on the frontend from `web/lib/schemas.ts`'s `SKILLS`/`OUTCOMES` arrays. Do not introduce a third copy.
- This feature is Upload-mode only. Do not touch LINK-mode code paths.
- Every non-trivial design/architecture decision made while executing this plan gets appended to `DECISIONS.md` at the repo root, per this project's `CLAUDE.md` durable instruction.
- Work happens on a feature branch off `main`, following this repo's existing convention (see recent `feature/*` branches in git log).

---

### Task 0: Create the feature branch

- [ ] **Step 1: Create and switch to the feature branch**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git checkout main
git pull
git checkout -b feature/ai-tag-suggestions
```

---

### Task 1: Backend — `aiTagging.ts` (Claude Haiku vision call)

**Files:**
- Modify: `server/src/config/env.ts`
- Modify: `server/.env.example`
- Modify: `server/package.json` (new dependency)
- Create: `server/src/lib/aiTagging.ts`
- Test: `server/tests/lib/aiTagging.test.ts`

**Interfaces:**
- Produces: `suggestTags(frames: string[]): Promise<{ skill: Skill; outcome: Outcome; confidence: number; rationale: string }>` — `frames` are `data:image/jpeg;base64,...` data URIs. Throws on any invalid/unparseable model response. Consumed by Task 2's route.
- Consumes: `config.anthropicApiKey` from `server/src/config/env.ts` (added in this task).

- [ ] **Step 1: Add the `ANTHROPIC_API_KEY` config field**

Edit `server/src/config/env.ts`, adding one line to the exported `config` object (same optional pattern as `supabaseUrl`):

```typescript
export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: required("DATABASE_URL"),
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
};
```

- [ ] **Step 2: Add the env var to `.env.example`**

Edit `server/.env.example`, adding (near the Supabase lines):

```
# Optional: enables the "Suggest tags with AI" feature on uploaded clips.
# Get a key at https://console.anthropic.com. Leave blank to disable the feature (no crash).
ANTHROPIC_API_KEY=""
```

- [ ] **Step 3: Install the Anthropic SDK**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/server"
npm install @anthropic-ai/sdk
```

- [ ] **Step 4: Write the failing tests**

Create `server/tests/lib/aiTagging.test.ts`:

```typescript
const mockCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

import { suggestTags } from "../../src/lib/aiTagging";

describe("suggestTags", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("parses a valid tool_use response into a typed suggestion", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: {
            skill: "SPIKE",
            outcome: "POINT_WON",
            confidence: 0.82,
            rationale: "Player jumps and strikes the ball over the net.",
          },
        },
      ],
    });

    const result = await suggestTags(["data:image/jpeg;base64,AAA"]);

    expect(result).toEqual({
      skill: "SPIKE",
      outcome: "POINT_WON",
      confidence: 0.82,
      rationale: "Player jumps and strikes the ball over the net.",
    });
  });

  it("sends each frame as a base64 image block plus one text block", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: { skill: "SERVE", outcome: "NO_POINT", confidence: 0.4, rationale: "Serve in progress." },
        },
      ],
    });

    await suggestTags(["data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BBB"]);

    const call = mockCreate.mock.calls[0][0];
    const content = call.messages[0].content;
    expect(content).toHaveLength(3); // 2 images + 1 text
    expect(content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "AAA" },
    });
    expect(content[1].source.data).toBe("BBB");
    expect(content[2].type).toBe("text");
  });

  it("throws when the model returns an out-of-enum skill", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          input: { skill: "NOT_A_SKILL", outcome: "POINT_WON", confidence: 0.5, rationale: "x" },
        },
      ],
    });

    await expect(suggestTags(["data:image/jpeg;base64,AAA"])).rejects.toThrow();
  });

  it("throws when no tool_use block is present in the response", async () => {
    mockCreate.mockResolvedValue({ content: [{ type: "text", text: "I'm not sure." }] });

    await expect(suggestTags(["data:image/jpeg;base64,AAA"])).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/server"
npx jest tests/lib/aiTagging.test.ts
```

Expected: FAIL — `Cannot find module '../../src/lib/aiTagging'`.

- [ ] **Step 6: Implement `server/src/lib/aiTagging.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Skill, Outcome } from "@prisma/client";
import { config } from "../config/env";

const suggestionSchema = z.object({
  skill: z.nativeEnum(Skill),
  outcome: z.nativeEnum(Outcome),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

export type TagSuggestion = z.infer<typeof suggestionSchema>;

const TAG_SUGGESTION_TOOL = {
  name: "suggest_tags",
  description: "Suggest the volleyball skill and point outcome shown across the provided video frames.",
  input_schema: {
    type: "object" as const,
    properties: {
      skill: { type: "string", enum: Object.values(Skill) },
      outcome: { type: "string", enum: Object.values(Outcome) },
      confidence: { type: "number", description: "Confidence from 0 to 1 that this classification is correct." },
      rationale: { type: "string", description: "One sentence explaining what in the frames led to this suggestion." },
    },
    required: ["skill", "outcome", "confidence", "rationale"],
  },
};

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

function toImageBlock(frame: string) {
  const data = frame.replace(/^data:image\/jpeg;base64,/, "");
  return {
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
  };
}

export async function suggestTags(frames: string[]): Promise<TagSuggestion> {
  const message = await getClient().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    tools: [TAG_SUGGESTION_TOOL],
    tool_choice: { type: "tool", name: "suggest_tags" },
    messages: [
      {
        role: "user",
        content: [
          ...frames.map(toImageBlock),
          {
            type: "text" as const,
            text: "These are sampled frames from a volleyball highlight clip, in chronological order. Identify the skill being performed and the point outcome.",
          },
        ],
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Model did not return a tool_use response");
  }

  return suggestionSchema.parse(toolUse.input);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/server"
npx jest tests/lib/aiTagging.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/config/env.ts server/.env.example server/package.json server/package-lock.json server/src/lib/aiTagging.ts server/tests/lib/aiTagging.test.ts
git commit -m "feat(server): add Claude Haiku vision call for tag suggestions"
```

---

### Task 2: Backend — `ai.routes.ts` (HTTP layer)

**Files:**
- Create: `server/src/routes/ai.routes.ts`
- Modify: `server/src/app.ts`
- Test: `server/tests/ai.routes.test.ts`

**Interfaces:**
- Consumes: `suggestTags` from `server/src/lib/aiTagging.ts` (Task 1), `config.anthropicApiKey` from `server/src/config/env.ts`, `ApiError` from `server/src/middleware/errorHandler.ts`.
- Produces: `GET /ai/status` → `{ available: boolean }`. `POST /ai/suggest-tags` → `{ skill, outcome, confidence, rationale }` on success; 503 if unconfigured; 400 on invalid input; 502 on suggestion failure. Consumed by Task 4's frontend hooks.

- [ ] **Step 1: Write the failing tests**

Create `server/tests/ai.routes.test.ts`:

```typescript
import request from "supertest";

const mockSuggestTags = jest.fn();
jest.mock("../src/lib/aiTagging", () => ({
  suggestTags: (...args: unknown[]) => mockSuggestTags(...args),
}));

import { createApp } from "../src/app";
import { config } from "../src/config/env";

describe("AI tagging routes", () => {
  const originalKey = config.anthropicApiKey;

  afterEach(() => {
    config.anthropicApiKey = originalKey;
    mockSuggestTags.mockReset();
  });

  describe("GET /ai/status", () => {
    it("reports available when a key is configured", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp()).get("/ai/status");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ available: true });
    });

    it("reports unavailable when no key is configured", async () => {
      config.anthropicApiKey = "";
      const res = await request(createApp()).get("/ai/status");
      expect(res.body).toEqual({ available: false });
    });
  });

  describe("POST /ai/suggest-tags", () => {
    it("returns 503 when unconfigured", async () => {
      config.anthropicApiKey = "";
      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"] });
      expect(res.status).toBe(503);
    });

    it("returns a suggestion when configured and frames are valid", async () => {
      config.anthropicApiKey = "test-key";
      mockSuggestTags.mockResolvedValue({
        skill: "SPIKE",
        outcome: "POINT_WON",
        confidence: 0.8,
        rationale: "Jump and strike.",
      });

      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"] });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        skill: "SPIKE",
        outcome: "POINT_WON",
        confidence: 0.8,
        rationale: "Jump and strike.",
      });
      expect(mockSuggestTags).toHaveBeenCalledWith(["data:image/jpeg;base64,AAA"]);
    });

    it("returns 400 when frames is missing", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp()).post("/ai/suggest-tags").send({});
      expect(res.status).toBe(400);
    });

    it("returns 400 when frames is an empty array", async () => {
      config.anthropicApiKey = "test-key";
      const res = await request(createApp()).post("/ai/suggest-tags").send({ frames: [] });
      expect(res.status).toBe(400);
    });

    it("returns 400 when frames has more than 4 items", async () => {
      config.anthropicApiKey = "test-key";
      const frames = Array(5).fill("data:image/jpeg;base64,AAA");
      const res = await request(createApp()).post("/ai/suggest-tags").send({ frames });
      expect(res.status).toBe(400);
    });

    it("returns 502 when the suggestion lib throws", async () => {
      config.anthropicApiKey = "test-key";
      mockSuggestTags.mockRejectedValue(new Error("boom"));

      const res = await request(createApp())
        .post("/ai/suggest-tags")
        .send({ frames: ["data:image/jpeg;base64,AAA"] });

      expect(res.status).toBe(502);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/server"
npx jest tests/ai.routes.test.ts
```

Expected: FAIL — route module doesn't exist / 404s.

- [ ] **Step 3: Implement `server/src/routes/ai.routes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { config } from "../config/env";
import { ApiError } from "../middleware/errorHandler";
import { suggestTags } from "../lib/aiTagging";

const router = Router();

const MAX_FRAMES = 4;
const MAX_FRAME_LENGTH = 2_000_000;

const suggestInput = z.object({
  frames: z.array(z.string().min(1).max(MAX_FRAME_LENGTH)).min(1).max(MAX_FRAMES),
});

router.get("/status", (_req, res) => {
  res.json({ available: Boolean(config.anthropicApiKey) });
});

router.post("/suggest-tags", async (req, res, next) => {
  try {
    if (!config.anthropicApiKey) {
      throw new ApiError(503, "AI tagging is not configured");
    }

    const { frames } = suggestInput.parse(req.body);
    const suggestion = await suggestTags(frames);
    res.json(suggestion);
  } catch (err) {
    if (err instanceof ApiError || err instanceof z.ZodError) {
      return next(err);
    }
    next(new ApiError(502, "AI suggestion failed"));
  }
});

export default router;
```

- [ ] **Step 4: Register the router in `server/src/app.ts`**

Edit `server/src/app.ts`:

```typescript
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
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/server"
npx jest tests/ai.routes.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 6: Run the full backend suite to check for regressions**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/server"
npx jest
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/routes/ai.routes.ts server/src/app.ts server/tests/ai.routes.test.ts
git commit -m "feat(server): add /ai/status and /ai/suggest-tags routes"
```

---

### Task 3: Frontend — `captureFrames.ts` (client-side frame sampling)

**Files:**
- Create: `web/lib/captureFrames.ts`
- Test: `web/tests/lib/captureFrames.test.ts`

**Interfaces:**
- Produces: `captureFrames(file: File, count?: number): Promise<string[]>` — resolves to `count` (default 4) base64 JPEG data URIs sampled at evenly-spaced timestamps. Consumed by Task 5's page wiring.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/lib/captureFrames.test.ts`:

```typescript
import { captureFrames } from "@/lib/captureFrames";

class FakeVideo extends EventTarget {
  muted = false;
  playsInline = false;
  duration = 10;
  videoWidth = 640;
  videoHeight = 360;
  src = "";
  seekedTimestamps: number[] = [];
  private _currentTime = 0;

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(value: number) {
    this._currentTime = value;
    this.seekedTimestamps.push(value);
    queueMicrotask(() => this.dispatchEvent(new Event("seeked")));
  }
}

function fakeCanvas() {
  return {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: jest.fn() }),
    toDataURL: jest.fn(() => "data:image/jpeg;base64,FAKE"),
  } as unknown as HTMLCanvasElement;
}

describe("captureFrames", () => {
  let fakeVideo: FakeVideo;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    fakeVideo = new FakeVideo();
    originalCreateElement = document.createElement.bind(document);

    jest.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "video") return fakeVideo as unknown as HTMLVideoElement;
      if (tag === "canvas") return fakeCanvas();
      return originalCreateElement(tag);
    }) as typeof document.createElement);

    global.URL.createObjectURL = jest.fn(() => "blob:fake");
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("captures 4 frames at 20/40/60/80% of duration", async () => {
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    const promise = captureFrames(file);
    fakeVideo.dispatchEvent(new Event("loadedmetadata"));

    const frames = await promise;

    expect(frames).toHaveLength(4);
    expect(frames.every((f) => f === "data:image/jpeg;base64,FAKE")).toBe(true);
    expect(fakeVideo.seekedTimestamps).toEqual([2, 4, 6, 8]);
  });

  it("revokes the object URL when done", async () => {
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    const promise = captureFrames(file);
    fakeVideo.dispatchEvent(new Event("loadedmetadata"));
    await promise;

    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });

  it("rejects when the video has no readable duration", async () => {
    fakeVideo.duration = NaN;
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    const promise = captureFrames(file);
    fakeVideo.dispatchEvent(new Event("loadedmetadata"));

    await expect(promise).rejects.toThrow();
  });

  it("rejects when the video element errors before loading metadata", async () => {
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    const promise = captureFrames(file);
    fakeVideo.dispatchEvent(new Event("error"));

    await expect(promise).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/web"
npx jest tests/lib/captureFrames.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/captureFrames'`.

- [ ] **Step 3: Implement `web/lib/captureFrames.ts`**

```typescript
export async function captureFrames(file: File, count = 4): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await waitForEvent(video, "loadedmetadata");

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("Could not read video duration");
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context unavailable");
    }

    const frames: string[] = [];
    for (let i = 1; i <= count; i++) {
      video.currentTime = (video.duration * i) / (count + 1);
      await waitForEvent(video, "seeked");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function waitForEvent(target: HTMLVideoElement, event: "loadedmetadata" | "seeked"): Promise<void> {
  return new Promise((resolve, reject) => {
    function onEvent() {
      cleanup();
      resolve();
    }
    function onError() {
      cleanup();
      reject(new Error(`Video failed while waiting for "${event}"`));
    }
    function cleanup() {
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
    }
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/web"
npx jest tests/lib/captureFrames.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/lib/captureFrames.ts web/tests/lib/captureFrames.test.ts
git commit -m "feat(web): add client-side video frame sampling"
```

---

### Task 4: Frontend — `useAiTagging.ts` (data hooks)

**Files:**
- Create: `web/hooks/useAiTagging.ts`
- Test: `web/tests/hooks/useAiTagging.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` from `web/lib/apiClient.ts`; `Skill`/`Outcome` from `web/lib/types.ts`.
- Produces: `useAiStatus()` → `useQuery` result whose `data` is `boolean | undefined`. `useSuggestTags()` → `useMutation` result whose `mutate(frames: string[])` resolves to `{ skill: Skill; outcome: Outcome; confidence: number; rationale: string }`. Consumed by Task 5's page wiring.

- [ ] **Step 1: Write the failing tests**

Create `web/tests/hooks/useAiTagging.test.tsx`:

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useAiStatus, useSuggestTags } from "@/hooks/useAiTagging";
import { createWrapper } from "@/tests/helpers/queryWrapper";

describe("useAiStatus", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns whether AI tagging is available", async () => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ available: true }), { status: 200 })
    ) as jest.Mock;

    const { result } = renderHook(() => useAiStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
  });
});

describe("useSuggestTags", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POSTs the frames and returns the suggestion", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({ skill: "SPIKE", outcome: "POINT_WON", confidence: 0.8, rationale: "Jump and strike." }),
          { status: 200 }
        )
    ) as jest.Mock;

    const { result } = renderHook(() => useSuggestTags(), { wrapper: createWrapper() });

    result.current.mutate(["data:image/jpeg;base64,AAA"]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      skill: "SPIKE",
      outcome: "POINT_WON",
      confidence: 0.8,
      rationale: "Jump and strike.",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ai/suggest-tags"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/web"
npx jest tests/hooks/useAiTagging.test.tsx
```

Expected: FAIL — `Cannot find module '@/hooks/useAiTagging'`.

- [ ] **Step 3: Implement `web/hooks/useAiTagging.ts`**

```typescript
"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Skill, Outcome } from "@/lib/types";

export interface TagSuggestion {
  skill: Skill;
  outcome: Outcome;
  confidence: number;
  rationale: string;
}

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai", "status"],
    queryFn: () => apiFetch<{ available: boolean }>("/ai/status").then((r) => r.available),
  });
}

export function useSuggestTags() {
  return useMutation({
    mutationFn: (frames: string[]) =>
      apiFetch<TagSuggestion>("/ai/suggest-tags", { method: "POST", body: JSON.stringify({ frames }) }),
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/web"
npx jest tests/hooks/useAiTagging.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/hooks/useAiTagging.ts web/tests/hooks/useAiTagging.test.tsx
git commit -m "feat(web): add data hooks for AI tag suggestions"
```

---

### Task 5: Frontend — wire into the upload form

**Files:**
- Modify: `web/app/clips/new/page.tsx`

**Interfaces:**
- Consumes: `captureFrames` (Task 3), `useAiStatus`/`useSuggestTags` (Task 4).

- [ ] **Step 1: Edit `web/app/clips/new/page.tsx`**

Add the new imports at the top (alongside the existing ones):

```typescript
import { captureFrames } from "@/lib/captureFrames";
import { useAiStatus, useSuggestTags } from "@/hooks/useAiTagging";
```

Add new state and hooks inside `NewClipPage`, alongside the existing `useState`/hook calls:

```typescript
  const { data: aiAvailable } = useAiStatus();
  const suggestTags = useSuggestTags();
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ confidence: number; rationale: string } | null>(null);
```

Add a handler function, near `selectMode`:

```typescript
  async function handleSuggestTags() {
    if (!file) return;
    setAiError(null);
    setAiSuggestion(null);
    try {
      const frames = await captureFrames(file);
      const suggestion = await suggestTags.mutateAsync(frames);
      setValue("skill", suggestion.skill);
      setValue("outcome", suggestion.outcome);
      setAiSuggestion({ confidence: suggestion.confidence, rationale: suggestion.rationale });
    } catch {
      setAiError("Couldn't generate a suggestion. You can still tag this clip manually.");
    }
  }
```

Replace the Upload-mode file input block (the `<div className="flex flex-col gap-2">...</div>` inside `mode === "UPLOAD"`) with:

```tsx
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setAiSuggestion(null);
                setAiError(null);
              }}
              className="text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/10 file:px-3 file:py-1.5 file:text-cyan-300"
            />
            {uploading && <p className="font-mono text-xs text-cyan-300">Uploading… {progress}%</p>}
            {uploadError && (
              <p className="text-sm text-rose-400">
                {uploadError} —{" "}
                <button type="button" onClick={() => file && upload(file).catch(() => {})} className="underline">
                  Retry
                </button>
              </p>
            )}
            {file && aiAvailable && (
              <button
                type="button"
                onClick={handleSuggestTags}
                disabled={suggestTags.isPending}
                className="btn-ghost self-start text-sm"
              >
                {suggestTags.isPending ? "Analyzing…" : "Suggest tags with AI"}
              </button>
            )}
            {aiSuggestion && (
              <p className="text-xs text-slate-400">
                AI suggested ({Math.round(aiSuggestion.confidence * 100)}% confidence) — please double-check.{" "}
                {aiSuggestion.rationale}
              </p>
            )}
            {aiError && <p className="text-xs text-rose-400">{aiError}</p>}
          </div>
```

- [ ] **Step 2: Type-check and lint**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/web"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the full frontend suite to check for regressions**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/web"
npx jest
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/app/clips/new/page.tsx
git commit -m "feat(web): wire AI tag suggestions into the upload form"
```

---

### Task 6: Live verification and DECISIONS.md entry

- [ ] **Step 1: Confirm `ANTHROPIC_API_KEY` is set in `server/.env`**

If not already set, get a key from `https://console.anthropic.com` and add it to `server/.env`. (This requires the user's own account — cannot be automated.)

- [ ] **Step 2: Restart the backend so it picks up the new env var and code**

```bash
lsof -nP -iTCP:4000 -sTCP:LISTEN -t | xargs -r kill
cd "/Users/darnelleudoxie/Desktop/Tavo Project/server"
(npm run dev > /tmp/setpoint-api.log 2>&1 &)
sleep 4
curl -s http://localhost:4000/ai/status
```

Expected: `{"available":true}`.

- [ ] **Step 3: Verify live in the browser**

Using the `claude-in-chrome` tool: navigate to `http://localhost:3000/clips/new`, switch to Upload mode, select a real video file, click "Suggest tags with AI", confirm the skill/outcome dropdowns pre-fill and the confidence caption renders, then submit and confirm the clip saves correctly. Delete the test clip afterward via `DELETE /clips/:id` (same cleanup convention used for every prior live-verification pass in this project).

- [ ] **Step 4: Append a `DECISIONS.md` entry**

Add an entry covering: the choice of Claude Haiku 4.5 over Sonnet (cost/latency vs. classification is a simple fixed-enum task), tool-use with a constrained JSON schema over free-form prompting + regex parsing (reliability), 4 evenly-spaced frames over 1 or 8 (coverage vs. request size), and the `GET /ai/status`-driven hide-the-button pattern over always-visible-with-error (consistency with this app's existing stance on not showing broken controls). This is a documentation-only change — no code.

- [ ] **Step 5: Commit the DECISIONS.md entry**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add DECISIONS.md
git commit -m "docs: log AI tag suggestions design decisions"
```

---

### Task 7: Finish the branch

- [ ] **Step 1: Run both full test suites one final time**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project/server" && npx jest
cd "/Users/darnelleudoxie/Desktop/Tavo Project/web" && npx jest
```

Expected: all tests pass in both.

- [ ] **Step 2: Use the finishing-a-development-branch skill**

Follow `superpowers:finishing-a-development-branch` to present merge/PR/keep-as-is options for `feature/ai-tag-suggestions` against `main`.
