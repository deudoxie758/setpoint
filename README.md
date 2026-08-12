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

### Local setup

1. `cd web && npm install`
2. `cp .env.example .env.local` — defaults point at `http://localhost:4000` (the local API) and `http://localhost:3000` (this app itself).
3. `npm test` — runs the FilterBar and playlist-reorder tests (the two pieces of frontend logic with real interaction/state logic, per the design spec).
4. `npm run dev` — starts the app on `http://localhost:3000`. Requires `server/` running locally too (see the Backend section above) and its Postgres container up.

### Notes

- Uploading a clip requires a real Supabase project configured in `server/.env` (see the Backend section's manual setup steps) — without it, the upload flow surfaces a friendly error with a Retry button rather than crashing, which is expected in local dev without those credentials.
- Most CRUD pages (players, clips library, playlists list/builder) are manually verified rather than unit-tested, per the design spec's testing scope — only the FilterBar and the playlist drag-reorder logic have dedicated tests.

## Design docs

- `docs/superpowers/specs/2026-08-10-setpoint-design.md` — full design spec.
- `docs/superpowers/plans/` — implementation plans.
