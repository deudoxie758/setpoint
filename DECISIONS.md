# Decisions Log — SetPoint

Running log of design/architecture decisions and the reasoning behind them, kept for interview prep. See `CLAUDE.md` for how this file is maintained.

## 2026-08-10 — Project scope: portfolio piece, not a real production tool

**Decision:** Build SetPoint as a portfolio-quality demo, not a tool intended for real coach/team usage.
**Alternatives considered:** Building it as an actual tool for a team/club to use.
**Reasoning:** Keeps scope YAGNI'd toward "demonstrates the interesting engineering decisions" rather than toward every feature a real recruiting tool would eventually need (multi-tenant orgs, notifications, moderation, etc.). Simplifies auth and infra choices downstream.

## 2026-08-10 — No authentication

**Decision:** No login/auth — single implicit workspace, anyone with the app URL can add/edit clips and players.
**Alternatives considered:** Simple email/password or magic-link auth scoped per coach; full auth with coach/player roles (closer to what the real Tavo product would need).
**Reasoning:** Auth adds meaningful build time without adding much to the portfolio story for this project — the interesting parts are the data model, filtering, and shareable playlist mechanics. Called out explicitly as a "next step" in the design spec so it doesn't read as an oversight in an interview.

## 2026-08-10 — Clip ingestion: support both linked and uploaded clips

**Decision:** Clips can either be a pasted link (YouTube/Hudl/Vimeo) or a direct file upload, not just one or the other.
**Alternatives considered:** Link-only (simplest, no storage/hosting needed); upload-only.
**Reasoning:** Link-only would've been the lower-effort choice, but supporting uploads gives a more complete "here's how I handled object storage and signed uploads" story for an interview, without being as heavy as building transcoding/hosting infra from scratch.

## 2026-08-10 — Infra: Supabase for both Postgres and Storage

**Decision:** Use Supabase for both the Postgres database and file storage (uploaded clips), rather than splitting across providers.
**Alternatives considered:** Neon (serverless Postgres) + Cloudflare R2 (S3-compatible object storage) as two best-of-breed services.
**Reasoning:** Both approaches are fully free-tier viable, so cost wasn't the differentiator. Supabase-everything means one account, one dashboard, one set of env vars, and no cross-service CORS/config to debug — meaningfully less friction to get to a working demo. Trade-off accepted: Supabase free-tier projects pause after 7 days of inactivity and need a manual un-pause before a demo. The Neon+R2 split remains a reasonable "what I'd do at scale to decouple storage from the DB vendor" answer for an interview.

## 2026-08-10 — Backend: separate Express API, not Next.js API routes

**Decision:** Build a standalone Express + TypeScript API (`server/`) rather than using Next.js API routes.
**Alternatives considered:** Next.js API routes colocated with the frontend — simpler single-deployable setup.
**Reasoning:** Mirrors the structure already used on Docket (separate `server/` dir), keeping frontend/backend concerns cleanly separated and giving a consistent story across portfolio projects, at the cost of having two things to deploy/run instead of one.

## 2026-08-10 — Skill field: fixed enum, not free text

**Decision:** The `skill` field on a Clip is a fixed enum (Serve, Ace, Spike/Kill, Block, Dig, Set, Assist) rather than free-text tags.
**Alternatives considered:** Free-text tags for flexibility; a hybrid of enum + optional free-text tag.
**Reasoning:** A fixed enum keeps filter dropdowns clean and reliable with zero data-entry drift (typos, near-duplicate tags). Flexibility wasn't worth the filtering-quality cost for a demo-scale dataset.

## 2026-08-10 — Playlists: manual curation + filter-based shortcut

**Decision:** Playlists support both manually adding individual clips in a chosen order, and a shortcut to bulk-add all clips matching a current filter view.
**Alternatives considered:** Manual curation only; dynamic saved-filter playlists (no fixed clip list).
**Reasoning:** Manual curation matches how a real recruiting reel gets built (deliberate, ordered selection) and is needed regardless. The filter-based bulk-add is a cheap addition on top that speeds up the common case ("all of Jane's kills this season") without replacing manual control with a purely dynamic view.

## 2026-08-10 — Project name and location

**Decision:** Named the project **SetPoint**; building it fresh in `~/Desktop/Tavo Project/` as its own git repo, separate from the Docket repo.
**Alternatives considered:** Names — Kill Reel, Rally Reel. Location — a new sibling folder on Desktop.
**Reasoning:** SetPoint's double meaning (match-deciding point / setting up a highlight reel) reads as clean and professional for a portfolio piece. The `Tavo Project` folder was already created for this purpose, so it made sense to build there rather than create yet another folder.
