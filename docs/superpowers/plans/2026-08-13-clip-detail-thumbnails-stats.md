# Clip Detail, Thumbnails, Player Stats, and UX Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the biggest functional gap (no way to edit or even view a single clip in detail), replace per-card live video embeds in the library grid with lightweight static thumbnails, add a per-player stats rollup, do a consistency pass on empty/loading/error states across every page, and write up how the finished app works.

**Architecture:** Two backend additions (a `thumbnailUrl` column computed at write-time, and a read-only stats aggregation endpoint) plus five frontend additions (clip detail/edit page, thumbnail-based `ClipCard`, player detail page, shared `Skeleton`/`EmptyState` components applied everywhere, and a written explainer doc). No new external dependencies — YouTube thumbnails are a deterministic static URL, Vimeo's oEmbed endpoint is a plain `fetch`, and stats are computed with Prisma's `groupBy`.

## Global Constraints

- Thumbnail computation must not block on YouTube (synchronous URL construction, no network call) but does block briefly on Vimeo (one `fetch` to `vimeo.com/api/oembed.json`, at clip create/update time only — never re-fetched on read).
- `thumbnailUrl` is nullable — uploaded clips and unrecognized link providers (e.g. Hudl) have no thumbnail and fall back to a placeholder, never a broken `<img>`.
- The public share page (`ClipCard readOnly`) keeps its live inline embed unchanged — the thumbnail swap is specifically for the library grid, where many cards render at once. A recruiter opening a share link has no other page to click through to watch the clip, so it must stay playable inline there.
- Stats reuse the existing `Skill`/`Outcome` enums — no schema change beyond the new `thumbnailUrl` column.
- Every list/detail page gets a considered empty state (message + a clear next action) and a loading skeleton — no bare `<p>Loading…</p>` text left after this plan, except where explicitly noted otherwise.
- Follow existing conventions exactly: TDD for backend logic and pure functions, `card`/`btn-primary`/`btn-ghost`/`field`/`badge` Tailwind component classes for UI, `ApiClientError` for surfaced mutation/query errors, `@/` import alias.

---

## File Structure

```
server/
  prisma/
    schema.prisma                        # + Clip.thumbnailUrl
    migrations/<timestamp>_add_clip_thumbnail/
  src/
    lib/
      thumbnail.ts                       # getThumbnailUrl(sourceType, url)
    routes/
      clips.routes.ts                    # modified: compute thumbnailUrl on create/update
      players.routes.ts                  # modified: add GET /:id/stats
  tests/
    lib/
      thumbnail.test.ts
    clips.routes.test.ts                 # modified
    players.routes.test.ts               # modified

web/
  app/
    clips/
      [id]/
        page.tsx                         # clip detail + edit form
    players/
      [id]/
        page.tsx                         # player detail + stats
    page.tsx                             # modified: empty state + skeleton
    players/page.tsx                     # modified: link to detail, empty state + skeleton
    playlists/
      page.tsx                           # modified: empty state + skeleton
      [id]/
        page.tsx                         # modified: empty state + skeleton
    share/
      [token]/
        page.tsx                         # modified: 0-clip empty state
  components/
    ClipCard.tsx                         # modified: static thumbnail instead of live embed (non-readOnly)
    Skeleton.tsx                         # new: CardSkeleton, ListSkeleton
    EmptyState.tsx                       # new: reusable empty state
  hooks/
    useClips.ts                          # + useClip(id), useUpdateClip()
    usePlayers.ts                        # + usePlayerStats(id)
  lib/
    types.ts                             # + Clip.thumbnailUrl, PlayerStats type

docs/
  HOW-IT-WORKS.md                        # new: architecture + feature walkthrough
```

---

### Task 1: `thumbnailUrl` column + computation helper

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/src/lib/thumbnail.ts`
- Test: `server/tests/lib/thumbnail.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getThumbnailUrl(sourceType: SourceType, url: string): Promise<string | null>` — Task 2 (clips routes) calls this at create/update time. `Clip.thumbnailUrl` column — Task 2 persists it, Task 5 (frontend types) mirrors it.

- [ ] **Step 1: Add the column to `server/prisma/schema.prisma`**

```prisma
model Clip {
  id            String         @id @default(cuid())
  title         String
  sourceType    SourceType
  url           String
  thumbnailUrl  String?
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
```

- [ ] **Step 2: Run the migration**

Run: `cd server && npx prisma migrate dev --name add_clip_thumbnail`
Expected: migration applies, `server/prisma/migrations/<timestamp>_add_clip_thumbnail/` is created, Prisma Client regenerated with no errors.

- [ ] **Step 3: Write the failing test**

`server/tests/lib/thumbnail.test.ts`:
```typescript
import { getThumbnailUrl } from "../../src/lib/thumbnail";

describe("getThumbnailUrl", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("builds a static img.youtube.com URL for a youtube.com/watch link, with no network call", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const result = await getThumbnailUrl("LINK", "https://www.youtube.com/watch?v=abc123");
    expect(result).toBe("https://img.youtube.com/vi/abc123/hqdefault.jpg");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("builds a static thumbnail URL for a youtube.com/shorts link", async () => {
    const result = await getThumbnailUrl("LINK", "https://www.youtube.com/shorts/xyz789");
    expect(result).toBe("https://img.youtube.com/vi/xyz789/hqdefault.jpg");
  });

  it("fetches the Vimeo oEmbed endpoint for a vimeo.com link", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ thumbnail_url: "https://i.vimeocdn.com/video/123_640.jpg" }), {
        status: 200,
      })
    ) as jest.Mock;

    const result = await getThumbnailUrl("LINK", "https://vimeo.com/76979871");

    expect(result).toBe("https://i.vimeocdn.com/video/123_640.jpg");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F76979871"
    );
  });

  it("returns null when the Vimeo oEmbed request fails", async () => {
    global.fetch = jest.fn(async () => new Response(null, { status: 404 })) as jest.Mock;

    const result = await getThumbnailUrl("LINK", "https://vimeo.com/does-not-exist-000");

    expect(result).toBeNull();
  });

  it("returns null for an unrecognized link provider", async () => {
    const result = await getThumbnailUrl("LINK", "https://hudl.com/video/xyz");
    expect(result).toBeNull();
  });

  it("returns null for an UPLOAD clip without making a network call", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const result = await getThumbnailUrl("UPLOAD", "https://storage.example.com/clip.mp4");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd server && npx jest tests/lib/thumbnail.test.ts`
Expected: FAIL — `Cannot find module '../../src/lib/thumbnail'`

- [ ] **Step 5: Create `server/src/lib/thumbnail.ts`**

```typescript
import { SourceType } from "@prisma/client";

export async function getThumbnailUrl(sourceType: SourceType, url: string): Promise<string | null> {
  if (sourceType !== "LINK") return null;

  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/);
  if (youtubeMatch) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    try {
      const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { thumbnail_url?: string };
      return data.thumbnail_url ?? null;
    } catch {
      return null;
    }
  }

  return null;
}
```

This mirrors `web/lib/embed.ts`'s YouTube/Vimeo URL parsing — kept as a separate, independently-tested copy on the backend rather than shared code, consistent with this project's existing separate-deployables decision (see `DECISIONS.md`).

- [ ] **Step 6: Run test to verify it passes**

Run: `cd server && npx jest tests/lib/thumbnail.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/prisma/schema.prisma server/prisma/migrations server/src/lib/thumbnail.ts server/tests/lib/thumbnail.test.ts
git commit -m "feat(server): add Clip.thumbnailUrl and a YouTube/Vimeo thumbnail resolver"
```

---

### Task 2: Wire thumbnail computation into clips routes; add clip detail data hooks

**Files:**
- Modify: `server/src/routes/clips.routes.ts`
- Test: `server/tests/clips.routes.test.ts`

**Interfaces:**
- Consumes: `getThumbnailUrl` (Task 1).
- Produces: `POST /clips` and `PATCH /clips/:id` responses now include `thumbnailUrl`. No new consumers within this task; Task 4 (frontend types) mirrors the field.

- [ ] **Step 1: Write the failing tests**

Add to `server/tests/clips.routes.test.ts` (new `describe` block at the end, before the closing of the file):
```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/clips.routes.test.ts -t "thumbnail"`
Expected: FAIL — `thumbnailUrl` is `undefined` on every response (route doesn't compute it yet).

- [ ] **Step 3: Modify `server/src/routes/clips.routes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { Skill, Outcome, SourceType } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";
import { getThumbnailUrl } from "../lib/thumbnail";

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
    const thumbnailUrl = await getThumbnailUrl(data.sourceType, data.url);
    const clip = await prisma.clip.create({ data: { ...data, thumbnailUrl } });
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
    if (data.playerId) {
      const player = await prisma.player.findUnique({ where: { id: data.playerId } });
      if (!player) throw new ApiError(400, "playerId does not reference an existing player");
    }

    let thumbnailUrl: string | null | undefined;
    if (data.url !== undefined || data.sourceType !== undefined) {
      const existing = await prisma.clip.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new ApiError(404, "Clip not found");
      thumbnailUrl = await getThumbnailUrl(data.sourceType ?? existing.sourceType, data.url ?? existing.url);
    }

    const clip = await prisma.clip.update({
      where: { id: req.params.id },
      data: { ...data, ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}) },
    });
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/clips.routes.test.ts`
Expected: PASS (all, including the pre-existing cases)

- [ ] **Step 5: Run the full backend suite**

Run: `cd server && npm test`
Expected: PASS — all suites.

- [ ] **Step 6: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/routes/clips.routes.ts server/tests/clips.routes.test.ts
git commit -m "feat(server): compute thumbnailUrl on clip create and url/sourceType updates"
```

---

### Task 3: Player stats aggregation endpoint

**Files:**
- Modify: `server/src/routes/players.routes.ts`
- Test: `server/tests/players.routes.test.ts`

**Interfaces:**
- Consumes: `prisma.clip.groupBy` (no new internal dependency).
- Produces: `GET /players/:id/stats` → `{ stats: { totalClips, pointWonPct, pointLostPct, noPointPct, attackEfficiency, bySkill: [{ skill, count, pointWonPct, pointLostPct, noPointPct }] } }`. Task 6 (frontend `usePlayerStats`) consumes this shape.

- [ ] **Step 1: Write the failing tests**

Add to `server/tests/players.routes.test.ts` (new `describe` block):
```typescript
describe("GET /players/:id/stats", () => {
  afterEach(async () => {
    await resetDb();
  });

  it("returns 404 for a player that doesn't exist", async () => {
    const res = await request(app).get("/players/does-not-exist/stats");
    expect(res.status).toBe(404);
  });

  it("returns zeroed stats for a player with no clips", async () => {
    const createRes = await request(app).post("/players").send({ name: "Jane Doe" });
    const id = createRes.body.player.id;

    const res = await request(app).get(`/players/${id}/stats`);

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual({
      totalClips: 0,
      pointWonPct: null,
      pointLostPct: null,
      noPointPct: null,
      attackEfficiency: null,
      bySkill: [],
    });
  });

  it("computes overall and per-skill percentages, and attack efficiency from SPIKE clips", async () => {
    const createRes = await request(app).post("/players").send({ name: "Jane Doe" });
    const id = createRes.body.player.id;

    const clip = (skill: string, outcome: string) =>
      request(app)
        .post("/clips")
        .send({
          title: `${skill} ${outcome}`,
          sourceType: "LINK",
          url: "https://youtube.com/watch?v=abc",
          playerId: id,
          skill,
          outcome,
        });

    await clip("SPIKE", "POINT_WON");
    await clip("SPIKE", "POINT_WON");
    await clip("SPIKE", "POINT_LOST");
    await clip("SPIKE", "NO_POINT");
    await clip("ACE", "POINT_WON");

    const res = await request(app).get(`/players/${id}/stats`);

    expect(res.status).toBe(200);
    expect(res.body.stats.totalClips).toBe(5);
    expect(res.body.stats.pointWonPct).toBe(60);
    expect(res.body.stats.pointLostPct).toBe(20);
    expect(res.body.stats.noPointPct).toBe(20);
    // (2 won - 1 lost) / 4 spike clips = 0.25
    expect(res.body.stats.attackEfficiency).toBe(0.25);

    const spikeRow = res.body.stats.bySkill.find((s: { skill: string }) => s.skill === "SPIKE");
    expect(spikeRow).toEqual({ skill: "SPIKE", count: 4, pointWonPct: 50, pointLostPct: 25, noPointPct: 25 });

    const aceRow = res.body.stats.bySkill.find((s: { skill: string }) => s.skill === "ACE");
    expect(aceRow).toEqual({ skill: "ACE", count: 1, pointWonPct: 100, pointLostPct: 0, noPointPct: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx jest tests/players.routes.test.ts -t "stats"`
Expected: FAIL — `GET /players/:id/stats` 404s as an unmatched route (falls through to the generic error handler with a different body shape than expected, or Express's default 404).

- [ ] **Step 3: Add the route to `server/src/routes/players.routes.ts`**

Add this import at the top:
```typescript
import { Outcome } from "@prisma/client";
```

Add this route (after the existing `GET /:id` route, before `PATCH /:id`):
```typescript
router.get("/:id/stats", async (req, res, next) => {
  try {
    const player = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!player) throw new ApiError(404, "Player not found");

    const grouped = await prisma.clip.groupBy({
      by: ["skill", "outcome"],
      where: { playerId: player.id },
      _count: true,
    });

    function pct(count: number, total: number): number | null {
      return total > 0 ? Math.round((count / total) * 1000) / 10 : null;
    }

    const totalClips = grouped.reduce((sum, g) => sum + g._count, 0);
    const outcomeTotals: Record<Outcome, number> = { POINT_WON: 0, POINT_LOST: 0, NO_POINT: 0 };
    for (const g of grouped) outcomeTotals[g.outcome] += g._count;

    type SkillTotals = Record<Outcome, number> & { count: number };
    const bySkillMap = new Map<string, SkillTotals>();
    for (const g of grouped) {
      const entry = bySkillMap.get(g.skill) ?? { count: 0, POINT_WON: 0, POINT_LOST: 0, NO_POINT: 0 };
      entry.count += g._count;
      entry[g.outcome] += g._count;
      bySkillMap.set(g.skill, entry);
    }

    const bySkill = Array.from(bySkillMap.entries()).map(([skill, s]) => ({
      skill,
      count: s.count,
      pointWonPct: pct(s.POINT_WON, s.count),
      pointLostPct: pct(s.POINT_LOST, s.count),
      noPointPct: pct(s.NO_POINT, s.count),
    }));

    const spike = bySkillMap.get("SPIKE");
    const attackEfficiency =
      spike && spike.count > 0 ? Math.round(((spike.POINT_WON - spike.POINT_LOST) / spike.count) * 1000) / 1000 : null;

    res.json({
      stats: {
        totalClips,
        pointWonPct: pct(outcomeTotals.POINT_WON, totalClips),
        pointLostPct: pct(outcomeTotals.POINT_LOST, totalClips),
        noPointPct: pct(outcomeTotals.NO_POINT, totalClips),
        attackEfficiency,
        bySkill,
      },
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest tests/players.routes.test.ts`
Expected: PASS (all, including pre-existing cases)

- [ ] **Step 5: Run the full backend suite**

Run: `cd server && npm test`
Expected: PASS — all suites.

- [ ] **Step 6: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add server/src/routes/players.routes.ts server/tests/players.routes.test.ts
git commit -m "feat(server): add per-player stats rollup (point-won%, attack efficiency, by-skill breakdown)"
```

---

### Task 4: Frontend types + data hooks for clip detail and player stats

**Files:**
- Modify: `web/lib/types.ts`
- Modify: `web/hooks/useClips.ts`
- Modify: `web/hooks/usePlayers.ts`

**Interfaces:**
- Consumes: `apiFetch` (existing), backend shapes from Tasks 2 and 3.
- Produces: `Clip.thumbnailUrl`, `PlayerStats` type; `useClip(id)`, `useUpdateClip()`, `usePlayerStats(id)` — Tasks 5 and 7 consume these.

- [ ] **Step 1: Add `thumbnailUrl` and `PlayerStats` to `web/lib/types.ts`**

Add `thumbnailUrl: string | null;` to the `Clip` interface (after `url`):
```typescript
export interface Clip {
  id: string;
  title: string;
  sourceType: SourceType;
  url: string;
  thumbnailUrl: string | null;
  playerId: string;
  skill: Skill;
  outcome: Outcome;
  opponent: string | null;
  matchDate: string | null;
  notes: string | null;
  createdAt: string;
}
```

Add at the end of the file:
```typescript
export interface SkillStats {
  skill: Skill;
  count: number;
  pointWonPct: number | null;
  pointLostPct: number | null;
  noPointPct: number | null;
}

export interface PlayerStats {
  totalClips: number;
  pointWonPct: number | null;
  pointLostPct: number | null;
  noPointPct: number | null;
  attackEfficiency: number | null;
  bySkill: SkillStats[];
}
```

- [ ] **Step 2: Add `useClip`/`useUpdateClip` to `web/hooks/useClips.ts`**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Clip, ClipWithPlayer, ClipFilters } from "@/lib/types";
import { ClipFormValues } from "@/lib/schemas";

function buildQuery(filters: ClipFilters): string {
  const params = new URLSearchParams();
  if (filters.playerId) params.set("playerId", filters.playerId);
  if (filters.skill) params.set("skill", filters.skill);
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.opponent) params.set("opponent", filters.opponent);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useClips(filters: ClipFilters = {}) {
  return useQuery({
    queryKey: ["clips", filters],
    queryFn: () => apiFetch<{ clips: ClipWithPlayer[] }>(`/clips${buildQuery(filters)}`).then((r) => r.clips),
  });
}

export function useClip(id: string) {
  return useQuery({
    queryKey: ["clips", id],
    queryFn: () => apiFetch<{ clip: ClipWithPlayer }>(`/clips/${id}`).then((r) => r.clip),
    enabled: Boolean(id),
  });
}

export function useCreateClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClipFormValues) =>
      apiFetch<{ clip: ClipWithPlayer }>("/clips", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clips"] }),
  });
}

export function useUpdateClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClipFormValues> }) =>
      apiFetch<{ clip: Clip }>(`/clips/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clips"] }),
  });
}
```

Same `["clips", ...]` prefix pattern already used for the list query (`["clips", filters]`) — invalidating `["clips"]` on update refreshes both the list and any open detail view, matching how `usePlaylists.ts` already does this for playlists.

- [ ] **Step 3: Add `usePlayerStats` to `web/hooks/usePlayers.ts`**

Add this import at the top (alongside the existing `Player` import):
```typescript
import { Player, PlayerStats } from "@/lib/types";
```

Add this function (after `usePlayers`):
```typescript
export function usePlayerStats(id: string) {
  return useQuery({
    queryKey: ["players", id, "stats"],
    queryFn: () => apiFetch<{ stats: PlayerStats }>(`/players/${id}/stats`).then((r) => r.stats),
    enabled: Boolean(id),
  });
}
```

- [ ] **Step 4: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds (no page references these hooks yet, but they must type-check standalone).

- [ ] **Step 5: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/lib/types.ts web/hooks/useClips.ts web/hooks/usePlayers.ts
git commit -m "feat(web): add clip detail/update and player stats data hooks"
```

---

### Task 5: Clip detail + edit page

**Files:**
- Create: `web/app/clips/[id]/page.tsx`

**Interfaces:**
- Consumes: `useClip`, `useUpdateClip` (Task 4), `usePlayers` (existing), `clipFormSchema`/`ClipFormValues`/`SKILLS`/`OUTCOMES` (existing), `getEmbedUrl` (existing).
- Produces: the `/clips/[id]` route. Task 6 (`ClipCard`) links here.

- [ ] **Step 1: Create `web/app/clips/[id]/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clipFormSchema, ClipFormValues, SKILLS, OUTCOMES } from "@/lib/schemas";
import { useClip, useUpdateClip } from "@/hooks/useClips";
import { usePlayers } from "@/hooks/usePlayers";
import { ApiClientError } from "@/lib/apiClient";
import { getEmbedUrl } from "@/lib/embed";

export default function ClipDetailPage({ params }: { params: { id: string } }) {
  const clipId = params.id;
  const { data: clip, isLoading, isError, error } = useClip(clipId);
  const { data: players } = usePlayers();
  const updateClip = useUpdateClip();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClipFormValues>({
    resolver: zodResolver(clipFormSchema),
    values: clip
      ? {
          title: clip.title,
          sourceType: clip.sourceType,
          url: clip.url,
          playerId: clip.playerId,
          skill: clip.skill,
          outcome: clip.outcome,
          opponent: clip.opponent ?? undefined,
          notes: clip.notes ?? undefined,
        }
      : undefined,
  });

  function onSubmit(values: ClipFormValues) {
    setSubmitError(null);
    setSaved(false);
    updateClip.mutate(
      { id: clipId, data: values },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => setSubmitError(err instanceof ApiClientError ? err.message : "Failed to save clip."),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
        <div className="aspect-video w-full animate-pulse rounded-lg bg-white/5" />
        <div className="h-48 w-full animate-pulse rounded-lg bg-white/5" />
      </div>
    );
  }

  if (isError || !clip) {
    return (
      <p className="text-sm text-rose-400">
        {error instanceof ApiClientError ? error.message : "This clip could not be found."}
      </p>
    );
  }

  const embedUrl = clip.sourceType === "LINK" ? getEmbedUrl(clip.url) : null;

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">Clip Detail</p>
        <h1 className="text-2xl font-bold text-slate-50">{clip.title}</h1>
        <p className="text-sm text-slate-400">
          {clip.player.name}
          {clip.opponent ? ` vs ${clip.opponent}` : ""}
        </p>
      </div>

      {clip.sourceType === "UPLOAD" ? (
        <video src={clip.url} controls className="aspect-video w-full rounded-lg bg-black" />
      ) : embedUrl ? (
        <iframe src={embedUrl} className="aspect-video w-full rounded-lg" allowFullScreen />
      ) : (
        <a href={clip.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">
          Open link ↗
        </a>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-3 p-4">
        <div>
          <input {...register("title")} placeholder="Title" className="field w-full bg-slate-900" />
          {errors.title && <p className="text-sm text-rose-400">{errors.title.message}</p>}
        </div>

        {clip.sourceType === "LINK" ? (
          <div>
            <input {...register("url")} placeholder="https://…" className="field w-full bg-slate-900" />
            {errors.url && <p className="text-sm text-rose-400">{errors.url.message}</p>}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Uploaded clips can&rsquo;t be re-uploaded here — delete and re-add to replace the file.
          </p>
        )}

        <select {...register("playerId")} className="field bg-slate-900">
          {players?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errors.playerId && <p className="text-sm text-rose-400">{errors.playerId.message}</p>}

        <select {...register("skill")} className="field bg-slate-900">
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select {...register("outcome")} className="field bg-slate-900">
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <input {...register("opponent")} placeholder="Opponent (optional)" className="field bg-slate-900" />
        <textarea {...register("notes")} placeholder="Notes (optional)" className="field bg-slate-900" />

        {submitError && <p className="text-sm text-rose-400">{submitError}</p>}
        {saved && !updateClip.isPending && <p className="text-sm text-emerald-400">Saved.</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={updateClip.isPending} className="btn-primary">
            Save changes
          </button>
          <Link href="/" className="btn-ghost">
            Back to library
          </Link>
        </div>
      </form>
    </div>
  );
}
```

`values` (not `defaultValues`) is used with `useForm` so the form re-syncs once the async `useClip` query resolves — the same pattern already used in `players/page.tsx` (there via imperative `reset()` since it's a single inline-edit form; here `values` is the more idiomatic choice since this page's whole state is "edit this one loaded record"). `sourceType` isn't user-editable but still flows through as part of `values`/submission, exactly as `clips/new/page.tsx` already does with `defaultValues: { sourceType: "LINK" }` plus `setValue`.

- [ ] **Step 2: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds, `/clips/[id]` listed as a dynamic route.

- [ ] **Step 3: Manually verify**

Run `cd server && npm run dev` and `cd web && npm run dev`. Create a clip, copy its id from the network tab or the library page's link (added in Task 6), visit `/clips/<id>`:
- Confirm the embed plays and the form is pre-filled.
- Change the title and skill, click Save changes, confirm the "Saved." message appears and the change persists on refresh.
- Visit `/clips/does-not-exist`, confirm a "Clip not found" message renders instead of a stuck loading state.

- [ ] **Step 4: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/app/clips/[id]
git commit -m "feat(web): add clip detail and edit page"
```

---

### Task 6: `ClipCard` — static thumbnails in the library grid, linked to the detail page

**Files:**
- Modify: `web/components/ClipCard.tsx`

**Interfaces:**
- Consumes: `clip.thumbnailUrl` (Task 4 type), `/clips/[id]` route (Task 5).
- Produces: updated `ClipCard` — no interface change (same props), used as-is by the library page (`/`) and the share page.

- [ ] **Step 1: Replace the live-embed block in `web/components/ClipCard.tsx`**

```tsx
import Link from "next/link";
import { ClipWithPlayer } from "@/lib/types";
import { getEmbedUrl } from "@/lib/embed";

interface Props {
  clip: ClipWithPlayer;
  selected?: boolean;
  onToggleSelected?: () => void;
  readOnly?: boolean;
}

const outcomeBadgeClass: Record<ClipWithPlayer["outcome"], string> = {
  POINT_WON: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  POINT_LOST: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  NO_POINT: "border-slate-400/30 bg-slate-400/10 text-slate-300",
};

function ClipMedia({ clip, readOnly }: { clip: ClipWithPlayer; readOnly: boolean }) {
  const embedUrl = clip.sourceType === "LINK" ? getEmbedUrl(clip.url) : null;

  // The public share page has no other page to click through to, so it always
  // gets the live, playable embed. The library grid renders many cards at
  // once — mounting a live <video>/<iframe> per card is real overhead, so it
  // gets a static thumbnail (or a placeholder) linking to the detail page instead.
  if (readOnly) {
    if (clip.sourceType === "UPLOAD") {
      return <video src={clip.url} controls className="aspect-video w-full rounded-lg bg-black" />;
    }
    if (embedUrl) {
      return <iframe src={embedUrl} className="aspect-video w-full rounded-lg" allowFullScreen />;
    }
    return (
      <a
        href={clip.url}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-video w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-cyan-300 underline"
      >
        Open link ↗
      </a>
    );
  }

  return (
    <Link href={`/clips/${clip.id}`} className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-black">
      {clip.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={clip.thumbnailUrl} alt={clip.title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.03] text-slate-600">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-10 w-10 text-white opacity-0 transition group-hover:opacity-100"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </Link>
  );
}

export function ClipCard({ clip, selected = false, onToggleSelected, readOnly = false }: Props) {
  return (
    <div className="card card-hover flex flex-col gap-3 p-3">
      {!readOnly && (
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-cyan-400"
          />
          Select
        </label>
      )}

      <ClipMedia clip={clip} readOnly={readOnly} />

      <div className="flex flex-col gap-2">
        {readOnly ? (
          <p className="font-medium text-slate-100">{clip.title}</p>
        ) : (
          <Link href={`/clips/${clip.id}`} className="font-medium text-slate-100 hover:text-cyan-300">
            {clip.title}
          </Link>
        )}
        <p className="text-sm text-slate-400">
          {clip.player.name}
          {clip.opponent ? ` vs ${clip.opponent}` : ""}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className="badge border-cyan-400/30 bg-cyan-400/10 text-cyan-300">{clip.skill}</span>
          <span className={`badge ${outcomeBadgeClass[clip.outcome]}`}>{clip.outcome.replace("_", " ")}</span>
        </div>
      </div>
    </div>
  );
}
```

`ClipCard.tsx` gains a `"use client"`-free `Link` import — it was already a plain (server-compatible) component, and `next/link` works in both server and client components, so no directive change is needed. It's rendered from `"use client"` parents (`app/page.tsx`) and a Server Component parent (`app/share/[token]/page.tsx`) either way.

- [ ] **Step 2: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manually verify**

Run both dev servers. On `/`, confirm clips render as static thumbnails (YouTube ones show the real video thumbnail), hovering shows a play-icon overlay, and clicking either the thumbnail or the title navigates to `/clips/<id>`. On a share link (`/share/<token>`), confirm clips still play inline as before (unchanged).

- [ ] **Step 4: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/components/ClipCard.tsx
git commit -m "feat(web): replace live per-card embeds with static thumbnails linking to clip detail"
```

---

### Task 7: Player detail page with stats

**Files:**
- Create: `web/app/players/[id]/page.tsx`
- Modify: `web/app/players/page.tsx` (link each player name to their detail page)

**Interfaces:**
- Consumes: `usePlayerStats` (Task 4), `usePlayers` (existing, for the player's own name/position — there's no single-player-by-id query, so this page finds the player from the already-cached list).
- Produces: the `/players/[id]` route.

- [ ] **Step 1: Create `web/app/players/[id]/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePlayers, usePlayerStats } from "@/hooks/usePlayers";

function StatBar({ label, pct, colorClass }: { label: string; pct: number | null; colorClass: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-mono">{pct === null ? "—" : `${pct}%`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  );
}

export default function PlayerDetailPage({ params }: { params: { id: string } }) {
  const playerId = params.id;
  const { data: players, isLoading: playersLoading } = usePlayers();
  const { data: stats, isLoading: statsLoading, isError } = usePlayerStats(playerId);

  const player = players?.find((p) => p.id === playerId);
  const isLoading = playersLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <div className="h-6 w-40 animate-pulse rounded bg-white/5" />
        <div className="h-32 w-full animate-pulse rounded-lg bg-white/5" />
      </div>
    );
  }

  if (isError || !player || !stats) {
    return <p className="text-sm text-rose-400">This player could not be found.</p>;
  }

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-cyan-400">Player</p>
        <h1 className="text-2xl font-bold text-slate-50">{player.name}</h1>
        <p className="text-sm text-slate-400">
          {player.position ?? "No position set"}
          {player.graduationYear ? ` — Class of ${player.graduationYear}` : ""}
        </p>
      </div>

      <div className="card flex flex-col gap-4 p-4">
        <h2 className="font-medium text-slate-200">Season overview</h2>
        {stats.totalClips === 0 ? (
          <p className="text-sm text-slate-500">
            No clips tagged for {player.name} yet.{" "}
            <Link href="/clips/new" className="text-cyan-300 hover:text-cyan-200">
              Add one
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">{stats.totalClips} clips logged</p>
            <StatBar label="Point-won rate" pct={stats.pointWonPct} colorClass="bg-emerald-400" />
            <StatBar label="Point-lost rate" pct={stats.pointLostPct} colorClass="bg-rose-400" />
            {stats.attackEfficiency !== null && (
              <p className="text-sm text-slate-300">
                Attack efficiency (spikes):{" "}
                <span className="font-mono text-cyan-300">{stats.attackEfficiency.toFixed(3)}</span>
              </p>
            )}
          </>
        )}
      </div>

      {stats.bySkill.length > 0 && (
        <div className="card flex flex-col gap-4 p-4">
          <h2 className="font-medium text-slate-200">By skill</h2>
          {stats.bySkill.map((s) => (
            <div key={s.skill} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono">{s.skill}</span>
                <span>{s.count} clips</span>
              </div>
              <StatBar label="Point-won rate" pct={s.pointWonPct} colorClass="bg-cyan-400" />
            </div>
          ))}
        </div>
      )}

      <Link href="/players" className="btn-ghost self-start">
        Back to players
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Link to it from `web/app/players/page.tsx`**

In the players list `<li>`, replace the plain name `<span>` with a `Link`:

```tsx
<Link href={`/players/${player.id}`} className="text-slate-200 hover:text-cyan-300">
  {player.name}
  {player.position ? <span className="text-slate-400"> — {player.position}</span> : ""}
  {player.graduationYear ? (
    <span className="ml-1 font-mono text-xs text-slate-500">'{String(player.graduationYear).slice(-2)}</span>
  ) : (
    ""
  )}
</Link>
```

Add `import Link from "next/link";` to the top of the file.

- [ ] **Step 3: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manually verify**

Tag a few clips for one player with a mix of outcomes, visit `/players/<id>`, confirm the overview and by-skill bars render sensible percentages, and that a player with zero clips shows the "Add one" empty state instead of empty bars.

- [ ] **Step 5: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/app/players/[id] web/app/players/page.tsx
git commit -m "feat(web): add player detail page with stats rollup"
```

---

### Task 8: Shared `Skeleton`/`EmptyState` components, applied across every page

**Files:**
- Create: `web/components/Skeleton.tsx`
- Create: `web/components/EmptyState.tsx`
- Modify: `web/app/page.tsx`
- Modify: `web/app/players/page.tsx`
- Modify: `web/app/playlists/page.tsx`
- Modify: `web/app/playlists/[id]/page.tsx`
- Modify: `web/app/share/[token]/page.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `CardGridSkeleton`, `ListSkeleton` (from `Skeleton.tsx`); `EmptyState` (icon-optional message + action) — used by every page below.

- [ ] **Step 1: Create `web/components/Skeleton.tsx`**

```tsx
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex flex-col gap-3 p-3">
          <div className="aspect-video w-full animate-pulse rounded-lg bg-white/5" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card h-12 animate-pulse bg-white/5 p-3" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `web/components/EmptyState.tsx`**

```tsx
import Link from "next/link";

interface Props {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function EmptyState({ title, description, actionHref, actionLabel }: Props) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <p className="font-medium text-slate-200">{title}</p>
      {description && <p className="text-sm text-slate-500">{description}</p>}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn-primary mt-2">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Apply to `web/app/page.tsx` (library)**

Replace:
```tsx
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clips?.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            selected={selected.has(clip.id)}
            onToggleSelected={() => toggleSelected(clip.id)}
          />
        ))}
      </div>
```
with:
```tsx
      {isLoading && <CardGridSkeleton />}

      {!isLoading && clips?.length === 0 && (
        <EmptyState
          title={Object.keys(filters).length > 0 ? "No clips match these filters" : "No clips yet"}
          description={
            Object.keys(filters).length > 0
              ? "Try clearing a filter to see more clips."
              : "Add your first highlight to start building the library."
          }
          actionHref={Object.keys(filters).length > 0 ? undefined : "/clips/new"}
          actionLabel={Object.keys(filters).length > 0 ? undefined : "Add clip"}
        />
      )}

      {!isLoading && clips && clips.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              selected={selected.has(clip.id)}
              onToggleSelected={() => toggleSelected(clip.id)}
            />
          ))}
        </div>
      )}
```

Add to the imports: `import { CardGridSkeleton } from "@/components/Skeleton";` and `import { EmptyState } from "@/components/EmptyState";`.

- [ ] **Step 4: Apply to `web/app/players/page.tsx`**

Replace:
```tsx
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
      {deleteError && <p className="text-sm text-rose-400">{deleteError}</p>}

      <ul className="flex flex-col gap-2">
```
with:
```tsx
      {isLoading && <ListSkeleton />}
      {deleteError && <p className="text-sm text-rose-400">{deleteError}</p>}

      {!isLoading && players?.length === 0 && (
        <EmptyState title="No players yet" description="Add a player above before tagging clips." />
      )}

      <ul className="flex flex-col gap-2">
```

Add to the imports: `import { ListSkeleton } from "@/components/Skeleton";` and `import { EmptyState } from "@/components/EmptyState";`.

- [ ] **Step 5: Apply to `web/app/playlists/page.tsx`**

Replace:
```tsx
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <ul className="flex flex-col gap-2">
```
with:
```tsx
      {isLoading && <ListSkeleton />}

      {!isLoading && playlists?.length === 0 && (
        <EmptyState title="No playlists yet" description="Create one above, then add clips to it from the library." />
      )}

      <ul className="flex flex-col gap-2">
```

Add to the imports: `import { ListSkeleton } from "@/components/Skeleton";` and `import { EmptyState } from "@/components/EmptyState";`.

- [ ] **Step 6: Apply to `web/app/playlists/[id]/page.tsx`**

Replace the `isLoading` early return:
```tsx
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
```
with:
```tsx
  if (isLoading) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <div className="h-6 w-48 animate-pulse rounded bg-white/5" />
        <ListSkeleton count={3} />
      </div>
    );
  }
```

Replace the `PlaylistClipList` block:
```tsx
      <PlaylistClipList
        clips={playlist.clips}
        onReorder={handleReorder}
        onRemove={(clipId) => removeClip.mutate({ playlistId, clipId })}
      />
```
with:
```tsx
      {playlist.clips.length === 0 ? (
        <EmptyState
          title="No clips in this playlist yet"
          description="Select clips from the library, or use the filter below to bulk-add."
          actionHref="/"
          actionLabel="Browse the library"
        />
      ) : (
        <PlaylistClipList
          clips={playlist.clips}
          onReorder={handleReorder}
          onRemove={(clipId) => removeClip.mutate({ playlistId, clipId })}
        />
      )}
```

Add to the imports: `import { ListSkeleton } from "@/components/Skeleton";` and `import { EmptyState } from "@/components/EmptyState";`.

- [ ] **Step 7: Verify the share page's 0-clip case in `web/app/share/[token]/page.tsx`**

Replace:
```tsx
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {playlist.clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} readOnly />
        ))}
      </div>
```
with:
```tsx
      {playlist.clips.length === 0 ? (
        <p className="text-sm text-slate-500">This playlist doesn&rsquo;t have any clips yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlist.clips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} readOnly />
          ))}
        </div>
      )}
```

No `EmptyState`/`actionHref` here — an external recruiter viewing a share link has nothing useful to click through to on this public, unauthenticated page, so a plain message is the right call (unlike every other page in this task, which is part of the coach's own authenticated workflow).

- [ ] **Step 8: Run the full frontend test suite**

Run: `cd web && npm test`
Expected: PASS — all existing tests (none of these are DOM-structure-sensitive in ways these changes affect; `FilterBar` and `reorder` tests are untouched by this task).

- [ ] **Step 9: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 10: Manually verify**

With the database emptied (or a fresh clone), visit `/`, `/players`, `/playlists`, a playlist with 0 clips, and a share link for a 0-clip playlist. Confirm each shows a considered empty state (or, for share, the plain message) rather than a blank area, and that loading states show skeleton placeholders on a throttled connection or by briefly checking the initial render.

- [ ] **Step 11: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/components/Skeleton.tsx web/components/EmptyState.tsx web/app/page.tsx web/app/players/page.tsx web/app/playlists/page.tsx "web/app/playlists/[id]/page.tsx" "web/app/share/[token]/page.tsx"
git commit -m "feat(web): add loading skeletons and empty states across every page"
```

---

### Task 9: `docs/HOW-IT-WORKS.md` — architecture and feature walkthrough

**Files:**
- Create: `docs/HOW-IT-WORKS.md`

**Interfaces:**
- Consumes: the finished app (Tasks 1–8) and the existing design spec/`DECISIONS.md`.
- Produces: nothing consumed by code — a reference document.

- [ ] **Step 1: Write `docs/HOW-IT-WORKS.md`**

Cover, in order: a one-paragraph summary; the two-deployable architecture diagram (as text/ASCII, `web/` ↔ `server/` ↔ Postgres/Supabase); the data model (Player/Clip/Playlist/PlaylistClip) with the reasoning for each relationship; a walkthrough of each user-facing feature (add a clip — link vs. upload flow end to end including the signed-URL handshake; the clip library and filtering; the clip detail/edit page; the thumbnail pipeline — YouTube static URL vs. Vimeo oEmbed, computed once at write time; playlists — manual add, drag reorder, filter-based bulk add, share links; the public share page; player stats — what's aggregated and how); testing approach; local setup pointers (linking to the README rather than duplicating it); and a "what I'd do with more time" section (auth, real thumbnail generation for uploads, etc.) — useful framing for an interview conversation. Keep it in prose/markdown, not a slide deck — this is a reference to read, not present.

This step doesn't have literal code to fill in ahead of time — it's written from the finished, verified implementation, so draft it last, after Tasks 1–8 are done and manually verified.

- [ ] **Step 2: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add docs/HOW-IT-WORKS.md
git commit -m "docs: add HOW-IT-WORKS.md explaining the app's architecture and features"
```

---

## Self-Review Notes

- **Spec coverage:** all four requested items are covered — clip detail/edit (Tasks 4–5), thumbnails (Tasks 1–2, 6), player stats (Tasks 3–4, 7), and the empty/loading/error consistency pass (Task 8) — plus the closing documentation (Task 9).
- **Type consistency:** `useClip`/`useUpdateClip` return types match what `clips/[id]/page.tsx` destructures; `usePlayerStats`'s `PlayerStats`/`SkillStats` types match the backend's `GET /players/:id/stats` response shape exactly (verified field names against the route's `res.json()` call). `ClipCard`'s props are unchanged, so its two existing call sites (library, share) need no signature changes — only its internals.
- **No placeholders:** every step has complete, runnable code. Task 9 is documentation, not code, and is explicitly scheduled last since it can only be written accurately once the rest is built and verified.
