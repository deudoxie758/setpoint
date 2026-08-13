# How SetPoint Works

SetPoint is a volleyball highlight clip library: a coach or player links or uploads match clips, tags each one with who made the play, what skill it was, and how the point ended, and organizes the good ones into shareable, filterable playlists for recruiting or film review. This document walks through how the finished app is put together and why, as a reference for explaining any part of it in an interview.

For the reasoning behind individual decisions (why Supabase over Neon+R2, why a separate Express API instead of Next.js API routes, why TanStack Query, etc.), see `DECISIONS.md` at the repo root — this document is the "how it fits together," that one is the "why we chose this."

## Architecture

Two independently deployable pieces talking over plain HTTP, plus one managed data platform:

```
┌─────────────────────┐        REST/JSON        ┌──────────────────────┐
│  web/  (Next.js)     │ ───────────────────────▶ │  server/  (Express)  │
│  App Router, TS,     │ ◀─────────────────────── │  TypeScript, Prisma  │
│  Tailwind             │                          │                      │
└─────────┬────────────┘                          └──────────┬───────────┘
          │                                                     │
          │  direct PUT to a                                    │  SQL
          │  signed Storage URL                                 ▼
          │  (upload flow only)                        ┌──────────────────┐
          └───────────────────────────────────────────▶│  Supabase          │
                                                          │  (Postgres +      │
                                                          │   Storage)         │
                                                          └──────────────────┘
```

- **`web/`** never talks to Postgres or Supabase Storage directly — every read and write goes through `server/`'s REST API via a single `apiFetch()` wrapper (`web/lib/apiClient.ts`). The one exception is the upload flow's final step, where the browser PUTs the video file straight to Supabase Storage using a signed URL the API handed it — the file bytes never pass through the Express server.
- **`server/`** owns all data access through Prisma, validates every request with Zod, and is the only thing that knows the database connection string or the Supabase service-role key.
- **Supabase** is used purely as infrastructure — a managed Postgres instance and an S3-compatible object store. Nothing SetPoint-specific runs inside Supabase (no edge functions, no RLS policies) — access control is "there is none," by design (see "No authentication" in `DECISIONS.md`).

This split exists so the two halves can be reasoned about, tested, and deployed independently — `server/` has its own test suite and can be exercised with nothing but `curl`, and `web/` never needs a real Supabase project to run its own tests.

## Data model

Four tables, all defined in `server/prisma/schema.prisma`:

```
Player  1 ──< Clip >── PlaylistClip ──< Playlist
```

- **`Player`** — name, position, graduation year. A clip always belongs to exactly one player.
- **`Clip`** — the core record. `sourceType` (`LINK` or `UPLOAD`) plus `url` describe where the video actually lives; `thumbnailUrl` is a separately-computed, cached preview image (see below). `skill` and `outcome` are fixed enums, not free text — `SERVE | ACE | SPIKE | BLOCK | DIG | SET | ASSIST` and `POINT_WON | POINT_LOST | NO_POINT` — chosen so filtering and the stats rollup can rely on a closed set of values instead of guessing at typo'd tags.
- **`Playlist`** — a named, shareable collection. `shareToken` is a separate unguessable field from `id` on purpose: the public `/share/:token` route never accepts or exposes the internal database id, so a leaked share link can't be walked to enumerate other playlists.
- **`PlaylistClip`** — the join table between `Playlist` and `Clip`, with a `position` integer for ordering and a composite primary key on `(playlistId, clipId)` so a clip can't be added to the same playlist twice. Both foreign keys cascade on delete — deleting a playlist or a clip cleans up its join rows automatically, no orphaned rows to garbage-collect.

`Clip.playerId` and `Clip` itself are protected by Postgres foreign-key constraints — you cannot delete a `Player` who still has clips (the API surfaces this as a `409 Conflict`, not a raw database error) or reference a `playerId`/`clipId` that doesn't exist (`400`).

## Feature walkthroughs

### Adding a clip

`/clips/new` (`web/app/clips/new/page.tsx`) has two modes, toggled client-side:

- **Link mode** — the coach pastes a URL. Client-side validation (`web/lib/schemas.ts`'s `clipFormSchema`) requires a fully-formed URL via the same `zod` `.url()` check the backend uses (`server/src/routes/clips.routes.ts`), so a link that would fail server-side never gets that far — no "type it, submit, get a confusing 400" round trip.
- **Upload mode** — the coach picks a local file. `web/hooks/useUpload.ts` first asks the API for a signed upload URL (`POST /uploads/sign`), then PUTs the file directly to that URL via `XMLHttpRequest` (not `fetch`, specifically because `XMLHttpRequest` is what exposes upload-progress events) with a live percentage shown in the form. The API server's job here is only to mint the signed URL — it never sees the video bytes.

Either way, the resulting `url` gets POSTed to `POST /clips` along with the player/skill/outcome/opponent/notes metadata, and the server computes a thumbnail (see below) before saving.

### Thumbnails

Every card in the library grid used to mount a live `<video>` or YouTube/Vimeo `<iframe>` — correct, but expensive to render dozens of at once, and it made the library read like a form-backed list rather than a media product. `Clip.thumbnailUrl` fixes that: a static preview image, computed once and cached in the database rather than fetched on every page load.

`server/src/lib/thumbnail.ts` computes it at write time (on create, and again on update if `url` or `sourceType` changes):

- **YouTube** — the video id is pulled out of the URL with a regex and the thumbnail is just `https://img.youtube.com/vi/<id>/hqdefault.jpg` — YouTube serves this directly, no API call, no network round-trip.
- **Vimeo** — Vimeo doesn't expose a predictable static thumbnail URL, so this makes one `fetch` to Vimeo's public oEmbed endpoint (`https://vimeo.com/api/oembed.json?url=...`) and reads `thumbnail_url` out of the response. This is the only place in the whole app that makes an outbound network call to a third party.
- **Uploaded clips and unrecognized link providers** (e.g. a bare Hudl URL) get `null` — the frontend falls back to a placeholder tile with a play icon rather than a broken `<img>`.

`web/components/ClipCard.tsx` uses the thumbnail (or the placeholder) for every card in the library grid, wrapped in a link to the clip's detail page. The **public share page is the one place that still uses the live embed** — a recruiter opening a share link has no other page to click through to watch the clip, so `ClipCard`'s `readOnly` mode keeps the old behavior unchanged.

### Clip library and filtering

`/` (`web/app/page.tsx`) lists every clip as a `ClipCard`, with a filter bar (`web/components/FilterBar.tsx`) for player, skill, outcome, and opponent (substring match). Filtering is server-side — `GET /clips` takes those as query params and Prisma does the `WHERE` — so the library scales past what a client-side filter over an already-fetched list would.

Selecting clips via each card's checkbox surfaces a small toolbar to bulk-add the selection to an existing playlist in one call (`POST /playlists/:id/clips`).

### Clip detail and edit

`/clips/[id]` (`web/app/clips/[id]/page.tsx`) is the one page that closes the loop the rest of the app didn't: before this existed, a coach could create a clip but never fix a typo'd title or re-tag a misclassified skill without going into the database directly. The page loads the clip, plays it inline exactly like the library card would, and pre-fills an edit form (the same `clipFormSchema` used by the create form) wired to `PATCH /clips/:id` — a route that existed on the backend from the start but had no frontend caller until this page.

### Playlists

`/playlists` lists playlists and lets you create new ones. `/playlists/[id]` (the "builder") is where a playlist actually gets assembled:

- **Manual add** — select clips in the library, bulk-add to a chosen playlist.
- **Drag-and-drop reorder** — `web/components/PlaylistClipList.tsx`, built on `dnd-kit`. The reorder math itself (`web/lib/reorder.ts`) is a small pure function, tested directly rather than by simulating drag gestures, since dnd-kit's pointer sensors don't reliably fire inside a headless test environment. On drop, the new order is sent as a full `clipIds` array to `PATCH /playlists/:id/clips/reorder` — the backend requires this to be an exact permutation of the playlist's current clips (rejecting a partial list with `400`) because a partial reorder would otherwise leave stale `position` values with nothing to catch a resulting duplicate.
- **Filter-based bulk add** — the builder page embeds the same `FilterBar` used on the library page; whatever currently matches the filter can be added to the playlist in one click, for "all of Jane's kills this season" style curation.
- **Share link** — every playlist gets an unguessable `shareToken` at creation. The builder shows the full `/share/<token>` URL with a one-click copy button.

### Public share page

`/share/[token]` (`web/app/share/[token]/page.tsx`) is a Next.js Server Component, not a client-rendered page — it fetches the playlist server-side and returns fully-rendered HTML, so a recruiter's link opens instantly with no client-side loading spinner. It's read-only (no select checkboxes, no edit links) and never receives or displays the playlist's internal `id`, only its clips. An invalid or expired token renders a friendly "this playlist link is no longer valid" message (`not-found.tsx`) instead of a raw 404, and any other failure (the API being down, a network error) is caught by a dedicated `error.tsx` boundary instead of Next's generic crash screen — since this is the one page in the app an external, non-technical visitor actually opens.

### Player stats

`/players/[id]` shows a season overview for one player: total clips logged, point-won/point-lost rate, "attack efficiency" (kills minus errors over total spike attempts — the standard volleyball formula, computed here from `SPIKE`-skill clips specifically), and a per-skill breakdown. All of it comes from one endpoint, `GET /players/:id/stats`, which is pure SQL aggregation — `prisma.clip.groupBy({ by: ["skill", "outcome"], where: { playerId } })` — with no new schema needed, since `skill` and `outcome` were already on every clip. A player with zero clips gets an explicit empty state pointing at "add a clip" rather than a blank chart.

## Error handling and empty states, as a system

Two patterns repeat across the whole app rather than being handled ad hoc per page:

- **Every mutation that can fail has an `onError` handler that surfaces the server's actual message.** This wasn't true in an earlier pass — a code review caught that several mutations (deleting a player with existing clips, reordering a playlist, saving a clip) failed silently or leaked as unhandled promise rejections. The fix was systematic: every `useMutation` call site in every page now has an `onError` that reads `ApiClientError.message` (the exact string the backend sent) into a piece of local state rendered right next to the action that failed.
- **Every list/detail page distinguishes loading, empty, and error explicitly**, rather than collapsing "no data yet" and "still loading" into one `isLoading` check. That distinction mattered concretely once: the playlist builder page originally rendered "Loading…" for both "the query hasn't resolved yet" and "the query resolved with an error and no data" (since both cases had `!playlist`), so visiting a deleted playlist's URL just hung on a permanent spinner. Every page now checks `isError` separately from `isLoading`, and every list page has a purpose-built empty state (`web/components/EmptyState.tsx`) with a clear next action, and a loading skeleton (`web/components/Skeleton.tsx`) instead of bare "Loading…" text.

## Testing

- **Backend** — Jest + Supertest, one `describe` block per resource, run with `--runInBand` against a real local Postgres (via `docker-compose.yml`), not a mock. Every route's happy path, validation failures, and foreign-key edge cases (delete-with-dependents, reference-a-nonexistent-id) have a test.
- **Frontend** — Jest + React Testing Library, deliberately scoped: the two pieces of frontend logic with real interaction/state (`FilterBar`, the playlist drag-reorder math) have full component/unit tests; the shared `apiClient`, `getEmbedUrl`, and `getThumbnailUrl`-equivalent helpers are tested directly; CRUD pages (players, clip forms, playlist list) are verified manually and via live browser checks rather than unit-tested, since they're mostly wiring a form to a mutation with little logic of their own to break.

## Local setup

See `README.md` at the repo root for exact commands — `docker compose up`, `npm install`/`npm test`/`npm run dev` in both `server/` and `web/`. The short version: both halves need to be running (`server/` on `:4000`, `web/` on `:3000`) against the same local Postgres for the app to work end to end.

## What I'd do with more time

- **Authentication.** Everything today is a single implicit workspace — deliberate, for portfolio scope (see `DECISIONS.md`), but the first real gap for actual team use. Coach-scoped accounts and per-workspace data isolation would be the next architectural layer, not a bolt-on.
- **Real thumbnails for uploaded clips.** Uploaded videos currently have no thumbnail at all (a placeholder tile) since generating one means either transcoding server-side or asking Supabase Storage for an image transform — both real infrastructure additions, not a quick win.
- **Optimistic UI for the playlist reorder.** The drag interaction is currently "drop, then wait for the server to confirm" — fine at this scale, but a playlist with many clips would benefit from updating the local order immediately and rolling back only on a rejected `PATCH`.
- **A richer stats surface.** The current rollup is one endpoint, one player, whole-season. A team-wide view, date-range filtering, or opponent-specific splits are natural next steps once there's more than a handful of demo clips to look at.
