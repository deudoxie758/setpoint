# AI Tag Suggestions — Design Spec

**Date:** 2026-08-13
**Status:** Approved (pending user review of this document)

## Summary

Adds an optional "Suggest tags with AI" feature to the clip-upload form: when a user selects a video file in Upload mode, they can trigger an AI suggestion for the clip's `skill` and `outcome` fields, based on frames sampled from the video. This is the first step toward making SetPoint "closer to Tavo" — Tavo's real differentiator is AI-assisted tagging, and this brings a scoped, honest version of that into the portfolio piece.

## Goals

- Pre-fill `skill`/`outcome` on the upload form from a vision model's read of sampled video frames, saving manual tagging effort.
- Keep the user in the loop — suggestions are visibly flagged as AI-generated with a confidence score, never silently auto-saved.
- Follow this project's existing optional-integration pattern (same shape as Supabase config): missing credentials degrade gracefully, no crash.

## Non-goals

- LINK-mode clips (YouTube/Vimeo/Hudl embeds) — frame sampling requires a local video `File` object, which LINK mode never has. This feature is Upload-mode only.
- Suggesting free-text fields (title, notes, opponent, match date) — out of scope; only `skill`/`outcome` have fixed enums a vision model can reliably classify against.
- Any server-side video storage/processing of the sampled frames — frames are extracted client-side and sent directly in the API request, never persisted.

## Architecture & data flow

1. User selects a video file in Upload mode. If the backend reports AI tagging as configured (`GET /ai/status`), a "Suggest tags with AI" button renders below the file input.
2. On click: the browser samples 4 evenly-spaced frames (20/40/60/80% of duration) from the selected `File` into base64 JPEGs, client-side, via a hidden `<video>` + `<canvas>`.
3. The frames are POSTed to `POST /ai/suggest-tags`.
4. The backend sends them as a multi-image message to Claude Haiku 4.5, using a tool-use schema that constrains the response to `{ skill, outcome, confidence, rationale }`, with `skill`/`outcome` restricted to this app's existing enum values.
5. The response is re-validated against the `SKILLS`/`OUTCOMES` zod enums before being returned (defense in depth).
6. The frontend pre-fills the `skill`/`outcome` dropdowns and shows a small caption below them: "AI suggested (72% confidence) — please double-check" plus the one-line rationale.

The suggestion only pre-fills form fields — the user still reviews and submits the form normally. Nothing here touches the clip-save path itself.

## Backend

- **`server/src/config/env.ts`** — add `anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? ""`. Optional, same pattern as `supabaseUrl`/`supabaseServiceRoleKey` — no startup crash if unset.
- **`server/src/lib/aiTagging.ts`** — `suggestTags(frames: string[]): Promise<{ skill: Skill; outcome: Outcome; confidence: number; rationale: string }>`. Uses the `@anthropic-ai/sdk` package (new dependency) to call `messages.create` with model `claude-haiku-4-5`, the frames as image content blocks, and a tool definition whose JSON schema restricts `skill`/`outcome` to the exact `SKILLS`/`OUTCOMES` values. Parses the tool-use response and re-validates with zod before returning; throws on an invalid/out-of-enum response.
- **`server/src/routes/ai.routes.ts`**:
  - `GET /ai/status` → `{ available: boolean }`, based on whether `config.anthropicApiKey` is set.
  - `POST /ai/suggest-tags` → validates body `{ frames: string[] }` (1–4 items, each a bounded-size base64 JPEG data URI; reject oversized/malformed payloads with 400). Throws `ApiError(503, "AI tagging is not configured")` if no key is set. Otherwise calls `suggestTags`; SDK/network/validation errors from that call are caught and re-thrown as `ApiError(502, "AI suggestion failed")`.
- Registered in **`server/src/app.ts`** alongside the other routers (`app.use("/ai", aiRoutes)`).
- **`server/.env.example`** — add `ANTHROPIC_API_KEY=""` with a comment, mirroring the existing Supabase entries.

## Frontend

- **`web/lib/captureFrames.ts`** — `captureFrames(file: File, count = 4): Promise<string[]>`. Creates an off-DOM `<video>` pointed at `URL.createObjectURL(file)`, waits for `loadedmetadata` to read `duration`, then for each of the 4 target timestamps: seeks the video, waits for `seeked`, draws the current frame to an off-DOM `<canvas>` sized to the video's dimensions, and reads it via `canvas.toDataURL("image/jpeg", 0.8)`. Revokes the object URL when done. Independent of the existing (server-side, provider-specific) thumbnail logic.
- **`web/hooks/useAiTagging.ts`**:
  - `useAiStatus()` — `useQuery` wrapping `GET /ai/status`, checked once per page load.
  - `useSuggestTags()` — `useMutation` wrapping `POST /ai/suggest-tags`, taking `frames: string[]`, returning `{ skill, outcome, confidence, rationale }`.
- **`web/app/clips/new/page.tsx`** — in Upload mode, once a file is selected and `useAiStatus()` reports available, render the "Suggest tags with AI" button. On click: `captureFrames(file)` (shows an "Analyzing…" state) → `useSuggestTags().mutate(frames)` → on success, `setValue("skill", ...)`, `setValue("outcome", ...)`, and store `{ confidence, rationale }` in local state to render the caption. On failure, show an inline error — no auto-retry; the user can click again or fill the dropdowns manually.

## Error handling & edge cases

- No API key configured → button never renders (driven by `GET /ai/status`).
- Video too short/corrupt for frame extraction (`loadedmetadata` never fires, or `duration` is 0) → `captureFrames` rejects; caught in the page with an inline error, no crash.
- Model returns an out-of-enum value (shouldn't happen given the tool schema, but defended anyway) → zod validation in `aiTagging.ts` throws → route returns 502 → frontend shows the same inline error path as any other suggestion failure.
- Anthropic API errors (rate limit, timeout, network) → wrapped as a generic 502; not distinguished further since this is a nice-to-have, not core functionality.
- Oversized/malformed frame payloads → rejected at zod input validation on `POST /ai/suggest-tags`, before ever calling the model.

## Testing strategy

TDD throughout, mirroring existing conventions:

- **`server/tests/ai.routes.test.ts`** — mirrors `uploads.routes.test.ts`'s `jest.mock("../src/lib/aiTagging")` pattern. Cases: `GET /ai/status` reflects config; `POST /ai/suggest-tags` returns 503 when unconfigured, 200 with a valid mocked response, 400 on missing/malformed `frames`, 502 when the mocked lib throws.
- **`server/tests/lib/aiTagging.test.ts`** — mocks the `@anthropic-ai/sdk` client; tests that a valid tool-use response parses correctly and that an out-of-enum response throws.
- **`web/tests/lib/captureFrames.test.ts`** — mocks `HTMLVideoElement`/`HTMLCanvasElement` (jsdom doesn't decode real video, so `loadedmetadata`/`seeked` events and `canvas.toDataURL` are stubbed, in the same spirit as `useUpload.test.tsx`'s `FakeXHR` pattern) to verify it seeks to the correct 4 timestamps and returns 4 data URIs.
- **`web/tests/hooks/useAiTagging.test.tsx`** — mocks `apiFetch`, mirrors `usePlayers.test.tsx`'s conventions.
- **Live verification** — real file → real frame capture → real Claude call → dropdowns pre-filled with a visible confidence caption, using the real `ANTHROPIC_API_KEY`, via the browser tool.
