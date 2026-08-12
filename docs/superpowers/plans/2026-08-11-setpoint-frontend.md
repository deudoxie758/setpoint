# SetPoint Frontend (web/) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SetPoint Next.js (App Router) frontend — clip library with filtering, add-clip form (link or upload), player management, playlist builder with drag-and-drop reorder, and a public read-only share view — talking only to the already-shipped `server/` API.

**Architecture:** Next.js App Router + TypeScript + Tailwind. TanStack Query owns all server state (fetching/caching/mutations against the API). react-hook-form + zod handle the player/clip/playlist forms. dnd-kit powers the playlist reorder UI. A thin `apiFetch` wrapper in `lib/apiClient.ts` is the only thing that talks to `NEXT_PUBLIC_API_URL`. Per the design spec's testing section, only the FilterBar and the playlist-reorder logic get dedicated tests (Jest + React Testing Library); other CRUD pages are verified manually via `npm run dev`, matching the "low interaction/state logic" pages the spec explicitly deprioritizes.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, TanStack Query v5, dnd-kit, react-hook-form + zod (+ `@hookform/resolvers`), Jest + React Testing Library + `@testing-library/user-event`.

## Global Constraints

- No authentication anywhere (matches the backend's "single implicit workspace" decision).
- The frontend talks to the backend only through `NEXT_PUBLIC_API_URL` via `lib/apiClient.ts` — never touches Postgres/Supabase directly, except the browser's direct PUT to the signed Supabase Storage URL during upload (per the spec's upload flow).
- `Skill` / `Outcome` / `SourceType` values must exactly match the backend's fixed enums: `SERVE|ACE|SPIKE|BLOCK|DIG|SET|ASSIST`, `POINT_WON|POINT_LOST|NO_POINT`, `LINK|UPLOAD`.
- All imports use the `@/` path alias (configured in Task 1) rather than relative `../../..` chains.
- Tailwind utility classes only — no separate component CSS files beyond `app/globals.css`.
- The public share page must never display a playlist's internal `id` — the `SharePlaylist` type (Task 2) has no `id` field, matching the backend's `/share/:token` response shape.
- Every task's code must pass `npm run build` (type-check + production build) before being considered done, even tasks without dedicated tests.

---

## File Structure

```
web/
  package.json
  tsconfig.json
  next.config.js
  tailwind.config.ts
  postcss.config.js
  jest.config.js
  jest.setup.ts
  .env.example
  app/
    layout.tsx                  # root layout: nav header + Providers
    globals.css
    page.tsx                    # "/" clip library
    clips/
      new/
        page.tsx                # "/clips/new"
    players/
      page.tsx                  # "/players"
    playlists/
      page.tsx                  # "/playlists"
      [id]/
        page.tsx                # "/playlists/[id]" builder
    share/
      [token]/
        page.tsx                # "/share/[token]" public view (Server Component)
        not-found.tsx            # friendly invalid-token page
  lib/
    types.ts                    # Player, Clip, Playlist, filter, and API response shapes
    schemas.ts                  # zod form schemas (player/clip/playlist) + SKILLS/OUTCOMES const arrays
    apiClient.ts                 # apiFetch() + ApiClientError
    embed.ts                     # getEmbedUrl() for YouTube/Vimeo link clips
    reorder.ts                   # reorderClipIds() pure function for drag-and-drop
  components/
    Providers.tsx                 # QueryClientProvider wrapper
    FilterBar.tsx                 # player/skill/outcome/opponent filter controls
    ClipCard.tsx                  # clip display, optional select checkbox, readOnly mode
    PlaylistClipList.tsx          # dnd-kit sortable list of a playlist's clips
  hooks/
    usePlayers.ts
    useClips.ts
    usePlaylists.ts
    useUpload.ts
  tests/
    app/
      page.test.tsx
    lib/
      apiClient.test.ts
      embed.test.ts
      reorder.test.ts
    hooks/
      usePlayers.test.tsx
      useUpload.test.tsx
    components/
      FilterBar.test.tsx
    helpers/
      queryWrapper.tsx

README.md                        # repo root: frontend section added in Task 14
.gitignore                       # repo root: verified to cover web/node_modules, web/.next, web/.env.local
```

---

### Task 1: Project scaffold — Next.js, Tailwind, TanStack Query, Jest/RTL, root layout

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.js`
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.js`
- Create: `web/jest.config.js`
- Create: `web/jest.setup.ts`
- Create: `web/.env.example`
- Create: `web/app/globals.css`
- Create: `web/app/layout.tsx`
- Create: `web/app/page.tsx` (placeholder, replaced in Task 8)
- Create: `web/components/Providers.tsx`
- Test: `web/tests/app/page.test.tsx`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the Next.js app shell every later task adds pages/components into; `Providers` (wraps `QueryClientProvider`) that every page implicitly gets via the root layout.

- [ ] **Step 1: Create `web/package.json`**

```json
{
  "name": "setpoint-web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@hookform/resolvers": "^3.9.0",
    "@tanstack/react-query": "^5.59.0",
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/jest": "^29.5.13",
    "@types/node": "^20.16.10",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.6.2"
  }
}
```

Run: `cd web && npm install`
Expected: install completes with no errors.

- [ ] **Step 2: Create `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `web/next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
```

- [ ] **Step 4: Create `web/tailwind.config.ts` and `web/postcss.config.js`**

`web/tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

`web/postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Create `web/.env.example` and a local `web/.env.local` copy**

`web/.env.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Run: `cp web/.env.example web/.env.local`
Expected: `web/.env.local` exists (gitignored — verified in Task 14).

- [ ] **Step 7: Create `web/components/Providers.tsx`**

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 8: Create `web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "SetPoint",
  description: "Volleyball highlight clip library",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <header className="border-b bg-white">
            <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm font-medium">
              <Link href="/" className="text-lg font-semibold">
                SetPoint
              </Link>
              <Link href="/">Library</Link>
              <Link href="/clips/new">Add Clip</Link>
              <Link href="/players">Players</Link>
              <Link href="/playlists">Playlists</Link>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Create the placeholder `web/app/page.tsx`**

```tsx
export default function Home() {
  return <p>Clip library coming soon.</p>;
}
```

This gets replaced with the real library page in Task 8.

- [ ] **Step 10: Create `web/jest.config.js` and `web/jest.setup.ts`**

`web/jest.config.js`:
```javascript
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  testMatch: ["<rootDir>/tests/**/*.test.tsx", "<rootDir>/tests/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

module.exports = createJestConfig(customJestConfig);
```

`web/jest.setup.ts`:
```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 11: Write the smoke test**

`web/tests/app/page.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("renders a placeholder", () => {
    render(<Home />);
    expect(screen.getByText("Clip library coming soon.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `cd web && npm test`
Expected: PASS

- [ ] **Step 13: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 14: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/package.json web/package-lock.json web/tsconfig.json web/next.config.js web/tailwind.config.ts web/postcss.config.js web/jest.config.js web/jest.setup.ts web/.env.example web/app web/components web/tests
git commit -m "feat(web): scaffold Next.js app with Tailwind, TanStack Query, and Jest/RTL"
```

---
### Task 2: Shared types, zod schemas, API client, and embed-URL helper

**Files:**
- Create: `web/lib/types.ts`
- Create: `web/lib/schemas.ts`
- Create: `web/lib/apiClient.ts`
- Create: `web/lib/embed.ts`
- Test: `web/tests/lib/apiClient.test.ts`
- Test: `web/tests/lib/embed.test.ts`

**Interfaces:**
- Consumes: nothing (types/schemas are foundational).
- Produces: `Player`, `Clip`, `ClipWithPlayer`, `Playlist`, `PlaylistWithClips`, `PlaylistClip`, `SharePlaylist`, `ClipFilters` types; `playerFormSchema`/`PlayerFormValues`, `clipFormSchema`/`ClipFormValues`, `playlistFormSchema`/`PlaylistFormValues`, `SKILLS`, `OUTCOMES` from `lib/schemas.ts`; `apiFetch<T>()` and `ApiClientError` from `lib/apiClient.ts`; `getEmbedUrl()` from `lib/embed.ts`. Every later task's hooks, components, and pages import from these three files.

- [ ] **Step 1: Create `web/lib/types.ts`**

These types mirror the exact JSON shapes the backend returns (verified live against the running API): create/update responses omit the `player`/`clips` relations that only `GET` (or add-clips/reorder) responses include, and `/share/:token` never returns `id` or `shareToken`.

```typescript
export type SourceType = "LINK" | "UPLOAD";
export type Skill = "SERVE" | "ACE" | "SPIKE" | "BLOCK" | "DIG" | "SET" | "ASSIST";
export type Outcome = "POINT_WON" | "POINT_LOST" | "NO_POINT";

export interface Player {
  id: string;
  name: string;
  position: string | null;
  graduationYear: number | null;
  createdAt: string;
}

export interface Clip {
  id: string;
  title: string;
  sourceType: SourceType;
  url: string;
  playerId: string;
  skill: Skill;
  outcome: Outcome;
  opponent: string | null;
  matchDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ClipWithPlayer extends Clip {
  player: Player;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  shareToken: string;
  createdAt: string;
}

export interface PlaylistClip {
  playlistId: string;
  clipId: string;
  position: number;
  clip: ClipWithPlayer;
}

export interface PlaylistWithClips extends Playlist {
  clips: PlaylistClip[];
}

export interface SharePlaylist {
  name: string;
  description: string | null;
  clips: ClipWithPlayer[];
}

export interface ClipFilters {
  playerId?: string;
  skill?: Skill;
  outcome?: Outcome;
  opponent?: string;
}
```

- [ ] **Step 2: Create `web/lib/schemas.ts`**

`url` is optional at the schema level and only required/validated when `sourceType` is `"LINK"` — an upload clip's `url` is filled in by the upload flow after the form's own validation passes, not typed by the user.

```typescript
import { z } from "zod";

export const playerFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  position: z.string().optional(),
  graduationYear: z.coerce.number().int().optional(),
});
export type PlayerFormValues = z.infer<typeof playerFormSchema>;

export const SKILLS = ["SERVE", "ACE", "SPIKE", "BLOCK", "DIG", "SET", "ASSIST"] as const;
export const OUTCOMES = ["POINT_WON", "POINT_LOST", "NO_POINT"] as const;

export const clipFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    sourceType: z.enum(["LINK", "UPLOAD"]),
    url: z.string().optional(),
    playerId: z.string().min(1, "Select a player"),
    skill: z.enum(SKILLS),
    outcome: z.enum(OUTCOMES),
    opponent: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.sourceType !== "LINK" || /^https?:\/\//.test(data.url ?? ""), {
    message: "Enter a valid URL",
    path: ["url"],
  });
export type ClipFormValues = z.infer<typeof clipFormSchema>;

export const playlistFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});
export type PlaylistFormValues = z.infer<typeof playlistFormSchema>;
```

- [ ] **Step 3: Write the failing test for `apiFetch`**

`web/tests/lib/apiClient.test.ts`:
```typescript
import { apiFetch, ApiClientError } from "@/lib/apiClient";

describe("apiFetch", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the parsed JSON body on success", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as jest.Mock;

    const result = await apiFetch<{ ok: boolean }>("/players");

    expect(result).toEqual({ ok: true });
  });

  it("returns undefined for a 204 response without attempting to parse a body", async () => {
    global.fetch = jest.fn(async () => new Response(null, { status: 204 })) as jest.Mock;

    const result = await apiFetch<void>("/players/1", { method: "DELETE" });

    expect(result).toBeUndefined();
  });

  it("throws an ApiClientError with the status and message on failure", async () => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
    ) as jest.Mock;

    await expect(apiFetch("/players/does-not-exist")).rejects.toThrow(ApiClientError);
    await expect(apiFetch("/players/does-not-exist")).rejects.toMatchObject({
      status: 404,
      message: "Not found",
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd web && npm test -- apiClient`
Expected: FAIL — `Cannot find module '@/lib/apiClient'`

- [ ] **Step 5: Create `web/lib/apiClient.ts`**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();

  if (!res.ok) {
    throw new ApiClientError(res.status, body.error ?? "Request failed", body.details);
  }

  return body as T;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && npm test -- apiClient`
Expected: PASS

- [ ] **Step 7: Write the failing test for `getEmbedUrl`**

`web/tests/lib/embed.test.ts`:
```typescript
import { getEmbedUrl } from "@/lib/embed";

describe("getEmbedUrl", () => {
  it("builds an embed URL for a youtube.com/watch link", () => {
    expect(getEmbedUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://www.youtube.com/embed/abc123"
    );
  });

  it("builds an embed URL for a youtu.be short link", () => {
    expect(getEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube.com/embed/abc123");
  });

  it("builds an embed URL for a vimeo.com link", () => {
    expect(getEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789"
    );
  });

  it("returns null for an unrecognized provider", () => {
    expect(getEmbedUrl("https://hudl.com/video/xyz")).toBeNull();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `cd web && npm test -- embed`
Expected: FAIL — `Cannot find module '@/lib/embed'`

- [ ] **Step 9: Create `web/lib/embed.ts`**

```typescript
export function getEmbedUrl(url: string): string | null {
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd web && npm test -- embed`
Expected: PASS

- [ ] **Step 11: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 12: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/lib web/tests/lib
git commit -m "feat(web): add shared types, zod schemas, API client, and embed-URL helper"
```

---
### Task 3: Players data hooks

**Files:**
- Create: `web/hooks/usePlayers.ts`
- Create: `web/tests/helpers/queryWrapper.tsx`
- Test: `web/tests/hooks/usePlayers.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Task 2), `Player` type (Task 2), `PlayerFormValues` (Task 2).
- Produces: `usePlayers()`, `useCreatePlayer()`, `useUpdatePlayer()`, `useDeletePlayer()` — every later task that needs the players list or player mutations (players page, clip form, filter bar wiring) uses these. `tests/helpers/queryWrapper.tsx`'s `createWrapper()` is reused by every later hook test.

- [ ] **Step 1: Create `web/tests/helpers/queryWrapper.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

export function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
```

- [ ] **Step 2: Write the failing test**

`web/tests/hooks/usePlayers.test.tsx`:
```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { usePlayers, useCreatePlayer } from "@/hooks/usePlayers";
import { createWrapper } from "@/tests/helpers/queryWrapper";

describe("usePlayers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fetches and returns the players list", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            players: [{ id: "1", name: "Jane Doe", position: null, graduationYear: null, createdAt: "2026-01-01" }],
          }),
          { status: 200 }
        )
    ) as jest.Mock;

    const { result } = renderHook(() => usePlayers(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe("Jane Doe");
  });
});

describe("useCreatePlayer", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POSTs the form values and returns the created player", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({ player: { id: "1", name: "Jane Doe", position: null, graduationYear: null, createdAt: "2026-01-01" } }),
          { status: 201 }
        )
    ) as jest.Mock;

    const { result } = renderHook(() => useCreatePlayer(), { wrapper: createWrapper() });

    result.current.mutate({ name: "Jane Doe" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/players"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npm test -- usePlayers`
Expected: FAIL — `Cannot find module '@/hooks/usePlayers'`

- [ ] **Step 4: Create `web/hooks/usePlayers.ts`**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Player } from "@/lib/types";
import { PlayerFormValues } from "@/lib/schemas";

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: () => apiFetch<{ players: Player[] }>("/players").then((r) => r.players),
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlayerFormValues) =>
      apiFetch<{ player: Player }>("/players", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PlayerFormValues> }) =>
      apiFetch<{ player: Player }>(`/players/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}

export function useDeletePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/players/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npm test -- usePlayers`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/hooks/usePlayers.ts web/tests/helpers/queryWrapper.tsx web/tests/hooks/usePlayers.test.tsx
git commit -m "feat(web): add players data hooks"
```

---

### Task 4: Players page

**Files:**
- Create: `web/app/players/page.tsx`

**Interfaces:**
- Consumes: `usePlayers`, `useCreatePlayer`, `useUpdatePlayer`, `useDeletePlayer` (Task 3), `playerFormSchema`/`PlayerFormValues` (Task 2), `Player` type (Task 2).
- Produces: the `/players` route. No later task depends on this page's internals — it's a leaf CRUD page, manually verified per the spec's testing scope.

- [ ] **Step 1: Create `web/app/players/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePlayers, useCreatePlayer, useUpdatePlayer, useDeletePlayer } from "@/hooks/usePlayers";
import { playerFormSchema, PlayerFormValues } from "@/lib/schemas";
import { Player } from "@/lib/types";

export default function PlayersPage() {
  const { data: players, isLoading } = usePlayers();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlayerFormValues>({ resolver: zodResolver(playerFormSchema) });

  function onSubmit(values: PlayerFormValues) {
    if (editingId) {
      updatePlayer.mutate(
        { id: editingId, data: values },
        {
          onSuccess: () => {
            setEditingId(null);
            reset();
          },
        }
      );
    } else {
      createPlayer.mutate(values, { onSuccess: () => reset() });
    }
  }

  function startEdit(player: Player) {
    setEditingId(player.id);
    reset({
      name: player.name,
      position: player.position ?? undefined,
      graduationYear: player.graduationYear ?? undefined,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    reset({ name: "", position: undefined, graduationYear: undefined });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Players</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-start gap-3">
        <div>
          <input {...register("name")} placeholder="Name" className="rounded border px-2 py-1" />
          {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <input {...register("position")} placeholder="Position" className="rounded border px-2 py-1" />
        <input
          {...register("graduationYear")}
          placeholder="Grad year"
          type="number"
          className="rounded border px-2 py-1"
        />
        <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-white">
          {editingId ? "Save" : "Add player"}
        </button>
        {editingId && (
          <button type="button" onClick={cancelEdit}>
            Cancel
          </button>
        )}
      </form>

      {isLoading && <p>Loading…</p>}

      <ul className="flex flex-col gap-2">
        {players?.map((player) => (
          <li key={player.id} className="flex items-center justify-between rounded border bg-white p-3">
            <span>
              {player.name}
              {player.position ? ` — ${player.position}` : ""}
              {player.graduationYear ? ` (${player.graduationYear})` : ""}
            </span>
            <div className="flex gap-3 text-sm">
              <button type="button" onClick={() => startEdit(player)}>
                Edit
              </button>
              <button type="button" onClick={() => deletePlayer.mutate(player.id)} className="text-red-600">
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manually verify**

Run: `cd web && npm run dev` (with `server/` also running via `npm run dev` in a separate terminal). Visit `http://localhost:3000/players`:
- Add a player, confirm it appears in the list.
- Click Edit, change the position, click Save, confirm the update shows.
- Click Delete, confirm it disappears.

- [ ] **Step 4: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/app/players
git commit -m "feat(web): add players page"
```

---
### Task 5: Clips data hooks

**Files:**
- Create: `web/hooks/useClips.ts`

**Interfaces:**
- Consumes: `apiFetch` (Task 2), `ClipWithPlayer`, `ClipFilters` types (Task 2), `ClipFormValues` (Task 2).
- Produces: `useClips(filters?)`, `useCreateClip()` — the library page (Task 8), clip form (Task 10), and playlist builder's "add matching filter" shortcut (Task 12) all use these.

- [ ] **Step 1: Create `web/hooks/useClips.ts`**

No dedicated test for this hook — it follows the exact same query/mutation shape already covered by `usePlayers.test.tsx` in Task 3 (fetch-and-return, POST-and-invalidate), so a second near-identical hook test would be low-value repetition rather than new coverage.

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { ClipWithPlayer, ClipFilters } from "@/lib/types";
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

export function useCreateClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ClipFormValues) =>
      apiFetch<{ clip: ClipWithPlayer }>("/clips", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clips"] }),
  });
}
```

- [ ] **Step 2: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/hooks/useClips.ts
git commit -m "feat(web): add clips data hooks"
```

---

### Task 6: Playlists data hooks

**Files:**
- Create: `web/hooks/usePlaylists.ts`

**Interfaces:**
- Consumes: `apiFetch` (Task 2), `Playlist`, `PlaylistWithClips` types (Task 2), `PlaylistFormValues` (Task 2).
- Produces: `usePlaylists()`, `usePlaylist(id)`, `useCreatePlaylist()`, `useAddClipsToPlaylist()`, `useReorderPlaylistClips()`, `useRemovePlaylistClip()` — the library page's bulk-add dropdown (Task 8), playlists list page (Task 12), and playlist builder page (Task 12) all use these.

- [ ] **Step 1: Create `web/hooks/usePlaylists.ts`**

Same reasoning as Task 5: no dedicated test, this mirrors the query/mutation shape already covered in Task 3.

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";
import { Playlist, PlaylistWithClips } from "@/lib/types";
import { PlaylistFormValues } from "@/lib/schemas";

export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: () => apiFetch<{ playlists: Playlist[] }>("/playlists").then((r) => r.playlists),
  });
}

export function usePlaylist(id: string) {
  return useQuery({
    queryKey: ["playlists", id],
    queryFn: () => apiFetch<{ playlist: PlaylistWithClips }>(`/playlists/${id}`).then((r) => r.playlist),
    enabled: Boolean(id),
  });
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlaylistFormValues) =>
      apiFetch<{ playlist: Playlist }>("/playlists", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useAddClipsToPlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, clipIds }: { playlistId: string; clipIds: string[] }) =>
      apiFetch<{ playlist: PlaylistWithClips }>(`/playlists/${playlistId}/clips`, {
        method: "POST",
        body: JSON.stringify({ clipIds }),
      }),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["playlists", variables.playlistId] }),
  });
}

export function useReorderPlaylistClips() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, clipIds }: { playlistId: string; clipIds: string[] }) =>
      apiFetch<{ playlist: PlaylistWithClips }>(`/playlists/${playlistId}/clips/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ clipIds }),
      }),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["playlists", variables.playlistId] }),
  });
}

export function useRemovePlaylistClip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ playlistId, clipId }: { playlistId: string; clipId: string }) =>
      apiFetch<void>(`/playlists/${playlistId}/clips/${clipId}`, { method: "DELETE" }),
    onSuccess: (_data, variables) =>
      queryClient.invalidateQueries({ queryKey: ["playlists", variables.playlistId] }),
  });
}
```

- [ ] **Step 2: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/hooks/usePlaylists.ts
git commit -m "feat(web): add playlists data hooks"
```

---
### Task 7: FilterBar component

**Files:**
- Create: `web/components/FilterBar.tsx`
- Test: `web/tests/components/FilterBar.test.tsx`

**Interfaces:**
- Consumes: `ClipFilters` type (Task 2), `SKILLS`/`OUTCOMES` (Task 2), `Player` type (Task 2).
- Produces: `FilterBar` component (`players`, `filters`, `onChange` props) — used by the library page (Task 8) and the playlist builder's "add matching filter" section (Task 12).

This is one of the two pieces of frontend logic the design spec calls out for dedicated testing, so it gets full TDD.

- [ ] **Step 1: Write the failing test**

`web/tests/components/FilterBar.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "@/components/FilterBar";
import { Player } from "@/lib/types";

const players: Player[] = [
  { id: "p1", name: "Jane Doe", position: null, graduationYear: null, createdAt: "2026-01-01" },
];

describe("FilterBar", () => {
  it("calls onChange with the selected player id", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FilterBar players={players} filters={{}} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Filter by player"), "p1");

    expect(onChange).toHaveBeenCalledWith({ playerId: "p1" });
  });

  it("calls onChange with the selected skill, preserving existing filters", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FilterBar players={players} filters={{ playerId: "p1" }} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Filter by skill"), "SPIKE");

    expect(onChange).toHaveBeenCalledWith({ playerId: "p1", skill: "SPIKE" });
  });

  it("calls onChange with the opponent text as it's typed", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FilterBar players={players} filters={{}} onChange={onChange} />);

    await user.type(screen.getByLabelText("Filter by opponent"), "Riv");

    expect(onChange).toHaveBeenLastCalledWith({ opponent: "Riv" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- FilterBar`
Expected: FAIL — `Cannot find module '@/components/FilterBar'`

- [ ] **Step 3: Create `web/components/FilterBar.tsx`**

```tsx
"use client";

import { ClipFilters, Skill, Outcome, Player } from "@/lib/types";
import { SKILLS, OUTCOMES } from "@/lib/schemas";

interface Props {
  players: Player[];
  filters: ClipFilters;
  onChange: (filters: ClipFilters) => void;
}

export function FilterBar({ players, filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        aria-label="Filter by player"
        value={filters.playerId ?? ""}
        onChange={(e) => onChange({ ...filters, playerId: e.target.value || undefined })}
        className="rounded border px-2 py-1"
      >
        <option value="">All players</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by skill"
        value={filters.skill ?? ""}
        onChange={(e) => onChange({ ...filters, skill: (e.target.value || undefined) as Skill | undefined })}
        className="rounded border px-2 py-1"
      >
        <option value="">All skills</option>
        {SKILLS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by outcome"
        value={filters.outcome ?? ""}
        onChange={(e) => onChange({ ...filters, outcome: (e.target.value || undefined) as Outcome | undefined })}
        className="rounded border px-2 py-1"
      >
        <option value="">All outcomes</option>
        {OUTCOMES.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <input
        aria-label="Filter by opponent"
        type="text"
        placeholder="Opponent"
        value={filters.opponent ?? ""}
        onChange={(e) => onChange({ ...filters, opponent: e.target.value || undefined })}
        className="rounded border px-2 py-1"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- FilterBar`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/components/FilterBar.tsx web/tests/components/FilterBar.test.tsx
git commit -m "feat(web): add FilterBar component"
```

---

### Task 8: Clip library page ("/")

**Files:**
- Create: `web/components/ClipCard.tsx`
- Modify: `web/app/page.tsx` (replace Task 1's placeholder)
- Modify: `web/tests/app/page.test.tsx` (replace the placeholder smoke test)

**Interfaces:**
- Consumes: `useClips` (Task 5), `usePlayers` (Task 3), `usePlaylists`/`useAddClipsToPlaylist` (Task 6), `FilterBar` (Task 7), `getEmbedUrl` (Task 2), `ClipWithPlayer`/`ClipFilters` types (Task 2).
- Produces: `ClipCard` component (with a `readOnly` prop) — reused as-is by the public share page in Task 13, so it's built with that reuse in mind now rather than modified later.

- [ ] **Step 1: Create `web/components/ClipCard.tsx`**

```tsx
import { ClipWithPlayer } from "@/lib/types";
import { getEmbedUrl } from "@/lib/embed";

interface Props {
  clip: ClipWithPlayer;
  selected?: boolean;
  onToggleSelected?: () => void;
  readOnly?: boolean;
}

export function ClipCard({ clip, selected = false, onToggleSelected, readOnly = false }: Props) {
  const embedUrl = clip.sourceType === "LINK" ? getEmbedUrl(clip.url) : null;

  return (
    <div className="flex flex-col gap-2 rounded border bg-white p-3">
      {!readOnly && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected} onChange={onToggleSelected} />
          Select
        </label>
      )}

      {clip.sourceType === "UPLOAD" ? (
        <video src={clip.url} controls className="aspect-video w-full rounded bg-black" />
      ) : embedUrl ? (
        <iframe src={embedUrl} className="aspect-video w-full rounded" allowFullScreen />
      ) : (
        <a href={clip.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
          Open link ↗
        </a>
      )}

      <div>
        <p className="font-medium">{clip.title}</p>
        <p className="text-sm text-slate-600">
          {clip.player.name} — {clip.skill} — {clip.outcome}
          {clip.opponent ? ` vs ${clip.opponent}` : ""}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `web/app/page.tsx` with the real library page**

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useClips } from "@/hooks/useClips";
import { usePlayers } from "@/hooks/usePlayers";
import { usePlaylists, useAddClipsToPlaylist } from "@/hooks/usePlaylists";
import { FilterBar } from "@/components/FilterBar";
import { ClipCard } from "@/components/ClipCard";
import { ClipFilters } from "@/lib/types";

export default function LibraryPage() {
  const [filters, setFilters] = useState<ClipFilters>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetPlaylistId, setTargetPlaylistId] = useState("");

  const { data: players } = usePlayers();
  const { data: clips, isLoading } = useClips(filters);
  const { data: playlists } = usePlaylists();
  const addClips = useAddClipsToPlaylist();

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function toggleSelected(clipId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  }

  function addSelectedToPlaylist() {
    if (!targetPlaylistId || selectedIds.length === 0) return;
    addClips.mutate(
      { playlistId: targetPlaylistId, clipIds: selectedIds },
      { onSuccess: () => setSelected(new Set()) }
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clip Library</h1>
        <Link href="/clips/new" className="rounded bg-slate-900 px-3 py-1 text-white">
          Add clip
        </Link>
      </div>

      <FilterBar players={players ?? []} filters={filters} onChange={setFilters} />

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded border bg-white p-3">
          <span>{selectedIds.length} selected</span>
          <select
            value={targetPlaylistId}
            onChange={(e) => setTargetPlaylistId(e.target.value)}
            aria-label="Target playlist"
            className="rounded border px-2 py-1"
          >
            <option value="">Choose a playlist…</option>
            {playlists?.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addSelectedToPlaylist} disabled={!targetPlaylistId}>
            Add to playlist
          </button>
        </div>
      )}

      {isLoading && <p>Loading…</p>}

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
    </div>
  );
}
```

- [ ] **Step 3: Replace the placeholder smoke test**

`web/tests/app/page.test.tsx` no longer applies to the real page (it needs a `QueryClientProvider` and mocked `fetch` to render meaningfully, and the design spec leaves list/CRUD pages to manual verification). Delete its contents and replace with a note that this page is manually verified:

Run: `rm web/tests/app/page.test.tsx`

- [ ] **Step 4: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manually verify**

Run: `cd web && npm run dev` (with `server/` running). Visit `http://localhost:3000/`:
- Confirm existing clips render with correct embeds (YouTube links embed inline, unrecognized links show "Open link ↗").
- Use the filter bar, confirm the grid updates.
- Select a couple of clips, choose a playlist, click "Add to playlist", confirm selection clears.

- [ ] **Step 6: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/components/ClipCard.tsx web/app/page.tsx
git rm web/tests/app/page.test.tsx
git commit -m "feat(web): add clip library page with filtering and bulk-add-to-playlist"
```

---
### Task 9: Upload hook

**Files:**
- Create: `web/hooks/useUpload.ts`
- Test: `web/tests/hooks/useUpload.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Task 2).
- Produces: `useUpload()` returning `{ upload(file), progress, error, uploading }` — the clip form (Task 10) uses this for the "Upload" mode.

The signed-URL request goes through `apiFetch`, but the actual file PUT needs upload-progress events, which `fetch` doesn't expose — so this uses `XMLHttpRequest` directly for that one call.

- [ ] **Step 1: Write the failing test**

`web/tests/hooks/useUpload.test.tsx`:
```tsx
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUpload } from "@/hooks/useUpload";

class FakeXHR {
  static instances: FakeXHR[] = [];
  upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  status = 200;
  open = jest.fn();
  send = jest.fn(() => {
    FakeXHR.instances.push(this);
  });
}

describe("useUpload", () => {
  beforeEach(() => {
    FakeXHR.instances = [];
    (global as unknown as { XMLHttpRequest: typeof FakeXHR }).XMLHttpRequest = FakeXHR;
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            uploadUrl: "https://fake.supabase.co/upload/abc.mp4",
            token: "t",
            path: "abc.mp4",
            publicUrl: "https://fake.supabase.co/public/abc.mp4",
          }),
          { status: 200 }
        )
    ) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requests a signed URL and resolves the public URL after a successful PUT", async () => {
    const { result } = renderHook(() => useUpload());
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    let uploadPromise: Promise<string>;
    act(() => {
      uploadPromise = result.current.upload(file);
    });

    await waitFor(() => expect(FakeXHR.instances).toHaveLength(1));
    act(() => {
      FakeXHR.instances[0].onload?.();
    });

    await expect(uploadPromise!).resolves.toBe("https://fake.supabase.co/public/abc.mp4");
  });

  it("sets an error message when the PUT fails", async () => {
    const { result } = renderHook(() => useUpload());
    const file = new File(["data"], "clip.mp4", { type: "video/mp4" });

    let uploadPromise: Promise<string>;
    act(() => {
      uploadPromise = result.current.upload(file);
    });

    await waitFor(() => expect(FakeXHR.instances).toHaveLength(1));
    act(() => {
      FakeXHR.instances[0].status = 500;
      FakeXHR.instances[0].onload?.();
    });

    await expect(uploadPromise!).rejects.toThrow();
    await waitFor(() => expect(result.current.error).toBe("Upload failed with status 500"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- useUpload`
Expected: FAIL — `Cannot find module '@/hooks/useUpload'`

- [ ] **Step 3: Create `web/hooks/useUpload.ts`**

```typescript
"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";

interface SignedUpload {
  uploadUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}

export function useUpload() {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File): Promise<string> {
    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const signed = await apiFetch<SignedUpload>("/uploads/sign", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name }),
      });

      await putWithProgress(signed.uploadUrl, file, setProgress);

      return signed.publicUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      throw err;
    } finally {
      setUploading(false);
    }
  }

  return { upload, progress, error, uploading };
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- useUpload`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/hooks/useUpload.ts web/tests/hooks/useUpload.test.tsx
git commit -m "feat(web): add upload hook with signed-URL flow and progress tracking"
```

---

### Task 10: Clip form and "/clips/new" page

**Files:**
- Create: `web/app/clips/new/page.tsx`

**Interfaces:**
- Consumes: `usePlayers` (Task 3), `useCreateClip` (Task 5), `useUpload` (Task 9), `clipFormSchema`/`ClipFormValues`/`SKILLS`/`OUTCOMES` (Task 2).
- Produces: the `/clips/new` route. No later task depends on this page's internals.

- [ ] **Step 1: Create `web/app/clips/new/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clipFormSchema, ClipFormValues, SKILLS, OUTCOMES } from "@/lib/schemas";
import { usePlayers } from "@/hooks/usePlayers";
import { useCreateClip } from "@/hooks/useClips";
import { useUpload } from "@/hooks/useUpload";

export default function NewClipPage() {
  const router = useRouter();
  const { data: players } = usePlayers();
  const createClip = useCreateClip();
  const { upload, progress, error: uploadError, uploading } = useUpload();
  const [mode, setMode] = useState<"LINK" | "UPLOAD">("LINK");
  const [file, setFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ClipFormValues>({
    resolver: zodResolver(clipFormSchema),
    defaultValues: { sourceType: "LINK" },
  });

  async function onSubmit(values: ClipFormValues) {
    let url = values.url;

    if (mode === "UPLOAD") {
      if (!file) return;
      url = await upload(file);
    }

    createClip.mutate({ ...values, sourceType: mode, url }, { onSuccess: () => router.push("/") });
  }

  function selectMode(next: "LINK" | "UPLOAD") {
    setMode(next);
    setValue("sourceType", next);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Add a clip</h1>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => selectMode("LINK")}
          className={mode === "LINK" ? "font-semibold underline" : ""}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => selectMode("UPLOAD")}
          className={mode === "UPLOAD" ? "font-semibold underline" : ""}
        >
          Upload
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <div>
          <input {...register("title")} placeholder="Title" className="w-full rounded border px-2 py-1" />
          {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
        </div>

        {mode === "LINK" ? (
          <div>
            <input {...register("url")} placeholder="https://…" className="w-full rounded border px-2 py-1" />
            {errors.url && <p className="text-sm text-red-600">{errors.url.message}</p>}
          </div>
        ) : (
          <div>
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {uploading && <p>Uploading… {progress}%</p>}
            {uploadError && (
              <p className="text-sm text-red-600">
                {uploadError} —{" "}
                <button type="button" onClick={() => file && upload(file)}>
                  Retry
                </button>
              </p>
            )}
          </div>
        )}

        <select {...register("playerId")} className="rounded border px-2 py-1">
          <option value="">Select player…</option>
          {players?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {errors.playerId && <p className="text-sm text-red-600">{errors.playerId.message}</p>}

        <select {...register("skill")} className="rounded border px-2 py-1">
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select {...register("outcome")} className="rounded border px-2 py-1">
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <input {...register("opponent")} placeholder="Opponent (optional)" className="rounded border px-2 py-1" />
        <textarea {...register("notes")} placeholder="Notes (optional)" className="rounded border px-2 py-1" />

        <button
          type="submit"
          disabled={uploading || createClip.isPending}
          className="rounded bg-slate-900 px-3 py-1 text-white"
        >
          Save clip
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manually verify**

Run: `cd web && npm run dev` (with `server/` running). Visit `http://localhost:3000/clips/new`:
- Add a Link clip, confirm it redirects to `/` and the clip appears.
- Switch to Upload mode; since local dev has no real Supabase project configured, confirm the error path renders (a friendly error message with a Retry button) rather than crashing — this is expected per the backend README's manual-setup note, not a bug.

- [ ] **Step 4: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/app/clips
git commit -m "feat(web): add clip form supporting link and upload sources"
```

---
### Task 11: Playlist reorder logic and drag-and-drop list

**Files:**
- Create: `web/lib/reorder.ts`
- Create: `web/components/PlaylistClipList.tsx`
- Test: `web/tests/lib/reorder.test.ts`

**Interfaces:**
- Consumes: `PlaylistClip` type (Task 2).
- Produces: `reorderClipIds(clips, activeClipId, overClipId): string[]`, `PlaylistClipList` component (`clips`, `onReorder`, `onRemove` props) — the playlist builder page (Task 12) uses both.

This is the second piece of frontend logic the design spec calls out for dedicated testing. The reorder math is extracted into a pure function and tested directly, rather than simulating actual pointer drag events through dnd-kit in jsdom — dnd-kit's sensors don't reliably fire in a jsdom test environment, so the pure function is what's actually testable; the drag UI itself is verified manually.

- [ ] **Step 1: Write the failing test**

`web/tests/lib/reorder.test.ts`:
```typescript
import { reorderClipIds } from "@/lib/reorder";
import { PlaylistClip, ClipWithPlayer } from "@/lib/types";

function makeClip(clipId: string, position: number): PlaylistClip {
  const clip: ClipWithPlayer = {
    id: clipId,
    title: clipId,
    sourceType: "LINK",
    url: "https://example.com",
    playerId: "p1",
    skill: "SPIKE",
    outcome: "POINT_WON",
    opponent: null,
    matchDate: null,
    notes: null,
    createdAt: "2026-01-01",
    player: { id: "p1", name: "Jane", position: null, graduationYear: null, createdAt: "2026-01-01" },
  };
  return { playlistId: "pl1", clipId, position, clip };
}

describe("reorderClipIds", () => {
  it("moves a clip from one position to another", () => {
    const clips = [makeClip("a", 0), makeClip("b", 1), makeClip("c", 2)];
    expect(reorderClipIds(clips, "a", "c")).toEqual(["b", "c", "a"]);
  });

  it("returns the original order when either id is unknown", () => {
    const clips = [makeClip("a", 0), makeClip("b", 1)];
    expect(reorderClipIds(clips, "a", "does-not-exist")).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm test -- reorder`
Expected: FAIL — `Cannot find module '@/lib/reorder'`

- [ ] **Step 3: Create `web/lib/reorder.ts`**

```typescript
import { arrayMove } from "@dnd-kit/sortable";
import { PlaylistClip } from "@/lib/types";

export function reorderClipIds(clips: PlaylistClip[], activeClipId: string, overClipId: string): string[] {
  const ids = clips.map((c) => c.clipId);
  const oldIndex = ids.indexOf(activeClipId);
  const newIndex = ids.indexOf(overClipId);
  if (oldIndex === -1 || newIndex === -1) return ids;
  return arrayMove(ids, oldIndex, newIndex);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm test -- reorder`
Expected: PASS

- [ ] **Step 5: Create `web/components/PlaylistClipList.tsx`**

```tsx
"use client";

import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlaylistClip } from "@/lib/types";
import { reorderClipIds } from "@/lib/reorder";

interface Props {
  clips: PlaylistClip[];
  onReorder: (clipIds: string[]) => void;
  onRemove: (clipId: string) => void;
}

export function PlaylistClipList({ clips, onReorder, onRemove }: Props) {
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(reorderClipIds(clips, String(active.id), String(over.id)));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={clips.map((c) => c.clipId)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {clips.map((pc) => (
            <SortableClipRow key={pc.clipId} playlistClip={pc} onRemove={onRemove} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableClipRow({
  playlistClip,
  onRemove,
}: {
  playlistClip: PlaylistClip;
  onRemove: (clipId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: playlistClip.clipId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between rounded border bg-white p-3">
      <div {...attributes} {...listeners} className="cursor-grab">
        {playlistClip.clip.title} — {playlistClip.clip.player.name}
      </div>
      <button type="button" onClick={() => onRemove(playlistClip.clipId)} className="text-sm text-red-600">
        Remove
      </button>
    </li>
  );
}
```

- [ ] **Step 6: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/lib/reorder.ts web/components/PlaylistClipList.tsx web/tests/lib/reorder.test.ts
git commit -m "feat(web): add playlist reorder logic and drag-and-drop clip list"
```

---

### Task 12: Playlists list page and playlist builder page

**Files:**
- Create: `web/app/playlists/page.tsx`
- Create: `web/app/playlists/[id]/page.tsx`

**Interfaces:**
- Consumes: `usePlaylists`/`usePlaylist`/`useCreatePlaylist`/`useReorderPlaylistClips`/`useRemovePlaylistClip`/`useAddClipsToPlaylist` (Task 6), `useClips` (Task 5), `usePlayers` (Task 3), `FilterBar` (Task 7), `PlaylistClipList` (Task 11), `playlistFormSchema`/`PlaylistFormValues` (Task 2).
- Produces: the `/playlists` and `/playlists/[id]` routes. No later task depends on these internals.

- [ ] **Step 1: Create `web/app/playlists/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { usePlaylists, useCreatePlaylist } from "@/hooks/usePlaylists";
import { playlistFormSchema, PlaylistFormValues } from "@/lib/schemas";

export default function PlaylistsPage() {
  const { data: playlists, isLoading } = usePlaylists();
  const createPlaylist = useCreatePlaylist();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlaylistFormValues>({ resolver: zodResolver(playlistFormSchema) });

  function onSubmit(values: PlaylistFormValues) {
    createPlaylist.mutate(values, { onSuccess: () => reset() });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Playlists</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-start gap-3">
        <div>
          <input {...register("name")} placeholder="Playlist name" className="rounded border px-2 py-1" />
          {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
        </div>
        <input
          {...register("description")}
          placeholder="Description (optional)"
          className="rounded border px-2 py-1"
        />
        <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-white">
          Create playlist
        </button>
      </form>

      {isLoading && <p>Loading…</p>}

      <ul className="flex flex-col gap-2">
        {playlists?.map((playlist) => (
          <li key={playlist.id} className="rounded border bg-white p-3">
            <Link href={`/playlists/${playlist.id}`} className="font-medium text-blue-600 underline">
              {playlist.name}
            </Link>
            {playlist.description && <p className="text-sm text-slate-600">{playlist.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Create `web/app/playlists/[id]/page.tsx`**

`params` is read directly from the props Next.js passes to every `page.tsx` (server or client) rather than via the `useParams` hook, since this component is the page itself.

```tsx
"use client";

import { useState } from "react";
import {
  usePlaylist,
  useReorderPlaylistClips,
  useRemovePlaylistClip,
  useAddClipsToPlaylist,
} from "@/hooks/usePlaylists";
import { useClips } from "@/hooks/useClips";
import { usePlayers } from "@/hooks/usePlayers";
import { FilterBar } from "@/components/FilterBar";
import { PlaylistClipList } from "@/components/PlaylistClipList";
import { ClipFilters } from "@/lib/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function PlaylistBuilderPage({ params }: { params: { id: string } }) {
  const playlistId = params.id;

  const { data: playlist, isLoading } = usePlaylist(playlistId);
  const reorder = useReorderPlaylistClips();
  const removeClip = useRemovePlaylistClip();
  const addClips = useAddClipsToPlaylist();

  const [filters, setFilters] = useState<ClipFilters>({});
  const { data: players } = usePlayers();
  const { data: filteredClips } = useClips(filters);

  function addAllMatchingFilter() {
    if (!filteredClips || filteredClips.length === 0) return;
    addClips.mutate({ playlistId, clipIds: filteredClips.map((c) => c.id) });
  }

  if (isLoading || !playlist) return <p>Loading…</p>;

  const shareUrl = `${APP_URL}/share/${playlist.shareToken}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{playlist.name}</h1>

      <div className="flex items-center gap-2 rounded border bg-white p-3">
        <span className="text-sm text-slate-600">Share link:</span>
        <code className="text-sm">{shareUrl}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>
          Copy
        </button>
      </div>

      <PlaylistClipList
        clips={playlist.clips}
        onReorder={(clipIds) => reorder.mutate({ playlistId, clipIds })}
        onRemove={(clipId) => removeClip.mutate({ playlistId, clipId })}
      />

      <div className="flex flex-col gap-3 rounded border bg-white p-3">
        <h2 className="font-medium">Add clips matching a filter</h2>
        <FilterBar players={players ?? []} filters={filters} onChange={setFilters} />
        <button type="button" onClick={addAllMatchingFilter} disabled={!filteredClips?.length}>
          Add {filteredClips?.length ?? 0} matching clips
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manually verify**

Run: `cd web && npm run dev` (with `server/` running).
- Visit `/playlists`, create a playlist, click into it.
- On the library page, select a couple of clips and add them to the playlist; confirm they appear in the builder in the order added.
- Drag to reorder; confirm the order persists after a page refresh.
- Click Remove on a clip; confirm it disappears.
- Click Copy on the share link; confirm the clipboard content matches.
- Use the "add matching filter" section with a skill filter; confirm it adds the filtered clips.

- [ ] **Step 5: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/app/playlists
git commit -m "feat(web): add playlists list and playlist builder pages"
```

---
### Task 13: Public share page

**Files:**
- Create: `web/app/share/[token]/page.tsx`
- Create: `web/app/share/[token]/not-found.tsx`

**Interfaces:**
- Consumes: `apiFetch`/`ApiClientError` (Task 2), `SharePlaylist` type (Task 2), `ClipCard` (Task 8, used with `readOnly`).
- Produces: the `/share/[token]` route. No later task depends on this page.

This page is a Server Component (not `"use client"`) — it fetches server-side and needs no mutations, which also means a share link opens fast with no client-side loading spinner, a nice property for a link sent to a recruiter.

- [ ] **Step 1: Create `web/app/share/[token]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/apiClient";
import { SharePlaylist } from "@/lib/types";
import { ClipCard } from "@/components/ClipCard";

async function getSharedPlaylist(token: string): Promise<SharePlaylist> {
  try {
    const res = await apiFetch<{ playlist: SharePlaylist }>(`/share/${token}`);
    return res.playlist;
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const playlist = await getSharedPlaylist(params.token);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{playlist.name}</h1>
        {playlist.description && <p className="text-slate-600">{playlist.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {playlist.clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} readOnly />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `web/app/share/[token]/not-found.tsx`**

This satisfies the design spec's error-handling requirement: "a friendly 'this playlist link is no longer valid' page rather than a raw error or 404."

```tsx
export default function ShareNotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="text-xl font-semibold">This playlist link is no longer valid</h1>
      <p className="text-slate-600">The link may have expired or the playlist may have been deleted.</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify the production build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manually verify**

Run: `cd web && npm run dev` (with `server/` running).
- Copy a real share link from a playlist builder page, open it, confirm the clips render read-only (no select checkboxes, no edit controls).
- Visit `/share/not-a-real-token`, confirm the friendly "no longer valid" message renders instead of a raw error.

- [ ] **Step 5: Commit**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add web/app/share
git commit -m "feat(web): add public read-only share page"
```

---

### Task 14: Root README and .gitignore verification

**Files:**
- Modify: `README.md` (repo root — add a Frontend section alongside the existing Backend section)
- Modify: `.gitignore` (repo root — verify/extend coverage for `web/`)

**Interfaces:**
- Consumes: nothing new — documents the completed frontend for a developer with zero context.
- Produces: nothing consumed by code.

- [ ] **Step 1: Confirm `.gitignore` covers frontend build artifacts**

Read `.gitignore` at the repo root — it already has generic `node_modules/`, `.env`, `.env.local`, `.next/`, `dist/`, `build/`, and `.DS_Store` patterns from Task 9 of the backend plan, which cover `web/node_modules/`, `web/.env.local`, and `web/.next/` too since git applies bare-filename/directory patterns at every depth.

Run: `git check-ignore web/.env.local web/node_modules web/.next`
Expected: all three paths print (confirms they're ignored). If any is missing, add it explicitly to `.gitignore`.

- [ ] **Step 2: Update `README.md`**

Add a "Frontend (`web/`)" section after the existing "Backend (`server/`)" section, before "Design docs":

```markdown
## Frontend (`web/`)

### Local setup

1. `cd web && npm install`
2. `cp .env.example .env.local` — defaults point at `http://localhost:4000` (the local API) and `http://localhost:3000` (this app itself).
3. `npm test` — runs the FilterBar and playlist-reorder tests (the two pieces of frontend logic with real interaction/state logic, per the design spec).
4. `npm run dev` — starts the app on `http://localhost:3000`. Requires `server/` running locally too (see the Backend section above) and its Postgres container up.

### Notes

- Uploading a clip requires a real Supabase project configured in `server/.env` (see the Backend section's manual setup steps) — without it, the upload flow surfaces a friendly error with a Retry button rather than crashing, which is expected in local dev without those credentials.
- Most CRUD pages (players, clips library, playlists list/builder) are manually verified rather than unit-tested, per the design spec's testing scope — only the FilterBar and the playlist drag-reorder logic have dedicated tests.
```

- [ ] **Step 3: Commit and push**

```bash
cd "/Users/darnelleudoxie/Desktop/Tavo Project"
git add README.md .gitignore
git commit -m "docs: add frontend setup section to README"
git push
```

---

## Self-Review Notes

- **Spec coverage:** all six routes from the design spec's Pages & Components table are covered (Task 8: `/`, Task 10: `/clips/new`, Task 4: `/players`, Task 12: `/playlists` and `/playlists/[id]`, Task 13: `/share/[token]`). Upload flow (Task 9), filtering (Task 7/8), bulk-add-from-filter (Task 12), drag reorder (Task 11), and the invalid-share-token friendly page (Task 13) are all present. Testing scope matches the spec's own callout (FilterBar + reorder logic get real tests; CRUD pages are manually verified).
- **Type consistency:** `ClipFilters` lives in `lib/types.ts` (not duplicated in `components/FilterBar.tsx`) so `FilterBar`, `useClips`, and the playlist builder's filter section all share one definition. `ClipCard`'s `readOnly`/optional `selected`/`onToggleSelected` props are defined once in Task 8 and reused unmodified by Task 13's share page. `usePlaylist` (singular, detail) vs. `usePlaylists` (plural, list) naming is consistent everywhere it's called (Task 8, Task 12). The share/window-origin bug (using `window.location.origin` in a page that Next.js server-renders before hydration) was caught during design and fixed by using `NEXT_PUBLIC_APP_URL` instead — see Task 12, Step 2.
- **No placeholders:** every step above has complete, runnable code — no TODOs or "implement similarly" references.

