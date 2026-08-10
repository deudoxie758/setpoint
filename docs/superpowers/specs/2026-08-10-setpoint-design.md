# SetPoint — Design Spec

**Date:** 2026-08-10
**Status:** Approved (pending user review of this document)

## Summary

SetPoint is a volleyball highlight clip library: coaches/players link or upload match clips, tag each with metadata (player, skill, outcome, opponent, date), and organize them into shareable, filterable playlists for recruiting or film review. It is the recruiting/highlight-reel half of Tavo's product, built as a focused, polished portfolio piece.

## Goals

- Portfolio-quality demo: clean data model, working filtering, real shareable links, deployed and live.
- Support both linked clips (YouTube/Hudl/Vimeo) and directly uploaded video files.
- No real-user friction: no login required to use the app or view a shared playlist.

## Non-goals

- Authentication / multi-tenant accounts (see "No authentication" decision below).
- Video transcoding, thumbnail generation, or advanced playback features.
- Moderation, notifications, or any multi-team/org structure.

## Architecture

Two deployables, following the same pattern as the Docket project:

- **`web/`** — Next.js (App Router) + TypeScript + Tailwind. All pages (library, playlist builder, public share view). Talks to the Express API for all data; never touches the database directly.
- **`server/`** — Express + TypeScript API. REST endpoints for players, clips, and playlists. Issues Supabase Storage signed upload URLs for direct-to-storage uploads.
- **Supabase** — hosts both the Postgres database (accessed via Prisma from `server/`) and Storage (for uploaded clip files).

**Upload flow:** browser requests a signed upload URL from the API → browser PUTs the video file directly to Supabase Storage (the API server never proxies the file) → browser confirms success and tells the API to save a Clip record pointing at the resulting storage URL.

**Linked clip flow:** browser saves a Clip record with the pasted URL directly — no storage interaction at all.

**No authentication:** the app has a single implicit workspace. Anyone with the app URL can add, edit, or delete players/clips/playlists. This is a deliberate scope cut, not an oversight — noted explicitly here as a "next step" (would add coach-scoped auth and per-workspace data isolation).

## Data model

Four tables via Prisma:

```
Player
  id              String  @id @default(cuid())
  name            String
  position        String?
  graduationYear  Int?
  createdAt       DateTime @default(now())

Clip
  id          String     @id @default(cuid())
  title       String
  sourceType  SourceType   // LINK | UPLOAD
  url         String       // external link, or Supabase Storage public URL
  playerId    String
  player      Player      @relation(fields: [playerId], references: [id])
  skill       Skill        // SERVE | ACE | SPIKE | BLOCK | DIG | SET | ASSIST
  outcome     Outcome      // POINT_WON | POINT_LOST | NO_POINT
  opponent    String?
  matchDate   DateTime?
  notes       String?
  createdAt   DateTime   @default(now())

Playlist
  id          String   @id @default(cuid())
  name        String
  description String?
  shareToken  String   @unique  // unguessable slug used in /share/[token]
  createdAt   DateTime @default(now())

PlaylistClip
  playlistId  String
  playlist    Playlist @relation(fields: [playlistId], references: [id])
  clipId      String
  clip        Clip     @relation(fields: [clipId], references: [id])
  position    Int      // ordering within the playlist
  @@id([playlistId, clipId])
```

Library filtering queries `Clip` directly by `playerId`, `skill`, `opponent` (and combinations thereof). A playlist's `shareToken` is the slug used at `/share/[token]` — viewing it requires no login, so it is trivially shareable with a recruiter via a plain URL.

## Pages & components

| Route | Purpose |
|---|---|
| `/` | Clip library: grid/list with filter bar (player, skill, opponent, outcome). Each card has a select checkbox for bulk-adding to a playlist. |
| `/clips/new` | Add a clip — choose Link or Upload, fill in metadata. Upload shows a progress bar while PUTting to Supabase Storage. |
| `/players` | Simple CRUD list for players (a clip must reference an existing player). |
| `/playlists` | List of playlists, links into each builder. |
| `/playlists/[id]` | Playlist builder — reorder clips (drag-and-drop), remove clips, view/copy the public share link. Also supports "add all clips matching the current library filter" as a bulk-add shortcut. |
| `/share/[token]` | Public, read-only playlist view — ordered clip playback, no editing controls, no navigation back into the main app. This is the link sent to a recruiter. |

## Error handling

- **Invalid/expired share token** → a friendly "this playlist link is no longer valid" page rather than a raw error or 404.
- **Upload failures** (e.g. network drop mid-PUT) → surfaced inline on the add-clip form with a retry action. A Clip record is only created after the client confirms the upload succeeded — no orphaned/partial records.
- **Malformed link URLs** → validated client-side (basic URL shape) before save. If the URL isn't from a recognized embeddable provider (YouTube/Vimeo/Hudl), the player falls back to a plain "open link" action instead of attempting an inline embed.

## Testing

- **API:** unit/integration tests per resource (players, clips, playlists) against a test Postgres database, following the same style as Docket's existing test setup.
- **Frontend:** component tests for the filter bar and playlist drag-reorder logic — the two pieces with real interaction/state logic. Straightforward CRUD forms and list rendering are lower-value to test heavily and are left to manual verification.

## Deployment

- `web/` deployed to Vercel (free tier).
- `server/` deployed to a free-tier host (Render or Fly — to be finalized during implementation).
- Supabase project (Postgres + Storage) on the free tier. Note: free-tier Supabase projects pause after 7 days of inactivity and require a manual un-pause from the dashboard before the app will work again — worth remembering before a live demo.

## Key decisions and alternatives considered

See `DECISIONS.md` at the repo root for the full log with reasoning. Summary of the decisions baked into this spec:

- Portfolio-scoped, not built for real production use.
- No authentication (single implicit workspace).
- Both linked and uploaded clips supported.
- Supabase for both Postgres and Storage, over a split Neon + Cloudflare R2 setup.
- Separate Express API rather than Next.js API routes, mirroring Docket's structure.
- Fixed skill enum rather than free-text tags.
- Playlists support manual curation plus a filter-based bulk-add shortcut.
