# ClipCleaner — Handover Brief

> A detailed brief for an AI assistant picking up this project. Written by the
> previous AI (Claude) after a multi-session collaboration with the project
> owner (a solo founder, self-described as semi-technical but comfortable with
> the command line). Read this top to bottom before advising.

---

## 1. What ClipCleaner is

**ClipCleaner is a pre-flight copyright scanner for content creators.** The
core value proposition: *catch copyrighted music in your video BEFORE you
upload it to YouTube / TikTok / etc., so you don't get a copyright strike or
demonetization after the fact.*

The pain it solves: creators (especially those editing in **CapCut**) finish a
video, upload it to a platform, and only then discover a background song
triggers Content ID. ClipCleaner moves that check earlier — you scan locally
first, fix problems, then upload clean.

**Target user:** solo creators (TikTok, YouTube, Reels). Often non-technical.
Often working with large 4K exports from CapCut (files can be 1–18 GB).

**Current status:** working prototype ("artifact") in a Replit-hosted pnpm
monorepo. Not yet migrated off Replit. Live ACRCloud scanning works when
credentials are configured.

---

## 2. How it works (user flow)

1. User drops an audio or video file into the web app.
2. App validates format + size.
3. **Audio extraction** — the app gets mono 16 kHz WAV audio out of the file
   (this is what the matching engine needs). Two paths (see §4).
4. The audio is decoded into an in-memory `AudioBuffer`.
5. **Scanning** — the audio is sliced into **30-second windows**; from each
   window a **10-second snippet** is extracted, base64-encoded, and sent to
   **ACRCloud** (a music-fingerprinting API) via the backend.
6. Matches are collected; a **risk level** is computed:
   - 0 matches → "safe"
   - 1–2 matches → "medium"
   - 3+ matches → "high"
7. If matches found, the app suggests **royalty-free replacement tracks**
   (currently a static stub list of 5 tracks; intended to become a real
   licensed catalog).

---

## 3. Tech stack & repo layout

- **Monorepo:** pnpm workspaces, TypeScript 5.9, Node 24
- **Frontend:** React 18 + Vite, Wouter (routing), TanStack Query, Tailwind +
  shadcn/ui (Radix), lucide-react icons
- **Backend:** Express 5, pino logging, esbuild bundle
- **API codegen:** Orval generates typed React-Query hooks + Zod schemas from an
  OpenAPI spec
- **Matching engine:** ACRCloud (HMAC-signed requests, proxied through backend
  so secrets never reach the browser)
- **Hosting (current):** Replit (autoscale deployment)

### Key paths
```
artifacts/clipcleaner/                 # the frontend SPA
  src/pages/Home.tsx                   # ENTIRE app UI + state machine (~550 lines)
  src/lib/audio.ts                     # extraction, WAV encoding, snippet base64
  vite.config.ts                       # has COOP/COEP plugin (see §6)
  server.mjs                           # Node static server for prod (COOP/COEP)
  .replit-artifact/artifact.toml       # Replit deploy config
artifacts/api-server/                  # the backend
  src/app.ts                           # express app (cors, json, router)
  src/routes/audio.ts                  # POST /api/audio/extract (ffmpeg)
  src/routes/acr.ts                    # /api/acr/* (status, identify, replacement-tracks)
  src/routes/health.ts                 # /api/healthz
  .replit-artifact/artifact.toml       # Replit deploy config
lib/api-client-react/                  # generated typed hooks (AcrIdentifyResult, etc.)
lib/api-zod/                           # generated Zod schemas (server-side validation)
replit.md                              # workspace + ClipCleaner architecture notes
```

### Important backend endpoints
- `GET  /api/healthz` — health check
- `GET  /api/acr/status` — whether ACRCloud creds are configured
- `POST /api/acr/identify` — sign + forward one audio snippet to ACRCloud, parse
  response into a typed `AcrIdentifyResult`
- `GET  /api/replacement-tracks` — static list of 5 royalty-free tracks
- `POST /api/audio/extract` — raw binary upload (≤500 MB), runs system `ffmpeg`
  to produce mono 16 kHz WAV, streams it back

### ACRCloud env vars (Replit secrets today)
- `ACR_ACCESS_KEY`, `ACR_ACCESS_SECRET` (required)
- `ACR_HOST` (optional, defaults to `identify-eu-west-1.acrcloud.com`)

---

## 4. The central engineering problem: file size & speed

This dominated our discussions. **The hardest constraint is that CapCut 4K
exports can be 1–18 GB, and a video can be 30–60 minutes long.** Naively
uploading an 18 GB file to a server to extract audio is slow and crashes.

### The key insight
ClipCleaner only needs the **audio** (~80–200 MB for an hour) — not the 4K
video frames (the other 17.8 GB). So the winning move is: **extract audio as
early as possible and never move the video over the network.**

### Two extraction paths (current design)
1. **In-browser (preferred):** `ffmpeg.wasm` runs on the user's device, strips
   the video, produces WAV. The video never leaves the computer. Requires the
   browser to be **cross-origin isolated** (`window.crossOriginIsolated`), which
   requires COOP/COEP headers on the page (see §6).
2. **Server fallback:** file is uploaded to `POST /api/audio/extract` (≤500 MB),
   the backend runs system `ffmpeg`. Used when the browser can't do path 1
   (no SharedArrayBuffer, older browsers, etc.).

### File-size tiers (in `audio.ts`)
- `SERVER_UPLOAD_LIMIT_MB = 500` — server route's hard cap
- `LARGE_FILE_THRESHOLD_MB = 1500` — browser memory ceiling (ffmpeg.wasm uses a
  32-bit heap; decoding ~doubles memory; 1.5 GB is the conservative cutoff)
- Files **over 1.5 GB** → a `TOO_LARGE` screen with **three escape hatches**
  (see §5, "Flavor A").

---

## 5. What was actually built (commit history on branch `claude/clip-cleaner-review-DfG4z`)

All work is on the branch **`claude/clip-cleaner-review-DfG4z`**, not yet merged.

### `ec0342c` — Hardened the scan loop
- Typed the state machine: `STEP` became a TS union; `results` went from
  `any[]` to `AcrIdentifyResult[]`; `fileType` uses `null` not `""`.
- **Resilience:** one failed window no longer aborts the whole scan; failures
  are collected into a warnings panel and the scan continues.
- Matches stream into the UI live as found.
- Reuse one `AudioContext` (was leaking one per file); close on reset/unmount.
- Fixed a progress off-by-one bug.
- Surface the server's JSON `details` error field instead of raw payload.
- Extracted magic numbers (30 / 10 / 3) into named constants.

### `337037e` — Smart-mode file handling
- `convertToWav` now prefers the in-browser ffmpeg path when the browser
  supports it, falls back to the server otherwise.
- Raised the public ceiling and added the `TOO_LARGE` screen (instead of a hard
  error) for oversized files, with guidance: "export audio only" / "export
  1080p."
- Added a Vite plugin to send COOP/COEP headers in dev/preview so the in-browser
  path works locally.

### `bb1755d` — Node static server for prod COOP/COEP
- Discovered Replit's static file serving can't set response headers, so the
  in-browser path was dead in production.
- Added `artifacts/clipcleaner/server.mjs` — a zero-dependency Node static
  server that sends COOP/COEP/CORP on every response. Has SPA fallback, MIME
  types, immutable caching for hashed assets, GET/HEAD gate, path-traversal
  guard.
- Updated the Replit artifact to run this server instead of `serve = "static"`.
- **Portability bonus:** the SPA now runs on any Node host, not just Replit.

### `336cfb1` — Flavor A: copy-paste ffmpeg command
- The `TOO_LARGE` screen got a third option for power users: a one-line
  `ffmpeg -i input.mp4 -vn -acodec libmp3lame -b:a 192k output.mp3` command with
  a Copy button and a link to ffmpeg.org. Lets users with 18 GB files extract
  audio locally and drop the small MP3 in.
- Context: we discussed a spectrum of "desktop helper" options (A = copy-paste
  command [~1hr], B = npx CLI tool [~1–2 days], C = real Electron/Tauri app
  [~1–2 weeks]). Shipped A; B/C deferred pending user demand data.

### `5bd3ce7` — Principal-dev gap-closing pass
- **Parallel scanning** (concurrency 4) replaced the sequential loop — a
  60-window scan went from ~2 min to ~30 s. Matches still stream live, sorted by
  offset.
- **Scan cancellation** via `AbortController` + a Cancel button.
- **Upload progress** for the server path (switched fetch → XHR to read
  `upload.onprogress`).
- **ffmpeg.wasm progress** wired through (`setProgress({ ratio })`).
- A new `ProgressReport` shape replaced the bare-string progress callback;
  processing card shows a real progress bar.
- `startScan` refuses to run if ACRCloud is unconfigured (was spamming N "not
  configured" failures).
- Faster base64 in `extractSnippet` (chunked, was an O(n²) per-byte hotspot).
- Lowered `LARGE_FILE_THRESHOLD_MB` 2048 → 1500.
- A11y: upload zone got keyboard support; fixed sticky `dragOver`.
- **Backend:** added a per-IP rate limiter to `/api/audio/extract` (6/min, 429 +
  retry-after). Fixed pre-existing `acr.ts` typecheck failures (typed the
  ACRCloud JSON response).

### `c6bd701` — Replit preview iframe fix
- Replit's *editor preview* loads the app in an iframe that can't be
  cross-origin isolated, so the in-browser path silently dies there (NOTE: this
  affects the *preview*, not deployed apps).
- Added `isIsolationBlockedByFrame()` and a banner with an "Open in new tab"
  link so users get a top-level document where headers work.
- Documented the caveat in `replit.md`.

**Every commit passed typecheck + build.** No automated tests exist (a known
gap).

---

## 6. Cross-origin isolation (COOP/COEP) — important context

The in-browser ffmpeg path needs `SharedArrayBuffer`, which browsers only expose
when the page is **cross-origin isolated**. That requires two response headers
on the SPA shell:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`

These are set in three places:
1. Vite dev/preview — via a plugin in `vite.config.ts`
2. Production — via `server.mjs`
3. (Future) whatever host serves the SPA must send them too

**The iframe gotcha:** even with headers, a page inside an iframe whose parent
doesn't grant isolation (Replit preview) will have `crossOriginIsolated ===
false`. That's why the "Open in new tab" banner exists. **Real deployed users
are unaffected** — they hit a top-level page.

---

## 7. Hosting / migration discussion (UNRESOLVED — the live decision)

The owner wants to **move off Replit**. We compared options in depth. Here's the
state of that discussion:

### Why move
- Replit cost (~$20–35/mo) is ~3× higher than alternatives at this scale.
- Single-region (slower first load for global creator audience).
- Vendor lock-in (`.replit-artifact`, `REPL_ID`, Replit Vite plugins).

### Options evaluated
- **AWS:** only App Runner fits cleanly (Lambda can't — 500 MB uploads + ffmpeg
  binary + long scans). App Runner ~$25–50/mo, 2–3× pricier than Fly. Rejected
  as overkill/overpriced for an MVP unless already in AWS.
- **Cloudflare all-in (Pages + Workers):** beautiful and ~$0, BUT Workers can't
  run system ffmpeg and cap request bodies at 100 MB — so it forces dropping the
  server-fallback extraction path. Viable only if going "browser-only."
- **Cloudflare Pages (frontend) + a real Node host (backend):** the recommended
  hybrid.

### Current recommendation (where we landed)
**Cloudflare Pages for the frontend + Fly.io for the backend** (the owner said
they're fine with the command line, so Fly's CLI is acceptable; earlier I'd
suggested Render as a no-CLI alternative at ~$7/mo).

Rationale:
- Pages: free, global edge, sets COOP/COEP via a `_headers` file.
- Fly: ~$5–10/mo, real Node + ffmpeg (keeps the server fallback), single-command
  deploy, low lock-in (just a Dockerfile + static site).
- Keep Replit running in parallel during transition — no big-bang switch.

### Migration plan (NOT yet executed — this is the next action if owner says go)
Files I would add to the branch:
- `Dockerfile` at repo root (Node 24 + ffmpeg + builds api-server)
- `fly.toml` for the api-server
- `_headers` + `_redirects` in `artifacts/clipcleaner/public/` for CF Pages
- A `VITE_API_URL` env var so the SPA knows where the backend lives (default to
  same-origin for local dev)
- A `DEPLOYING.md` walkthrough

Owner-side steps (~30–45 min): sign up CF + Fly, install flyctl, `fly launch` +
`fly secrets set` + `fly deploy`, connect CF Pages to the GitHub repo with the
right build command (`corepack enable && pnpm install && pnpm --filter
@workspace/clipcleaner build`, output dir `artifacts/clipcleaner/dist/public`),
set `VITE_API_URL` to the Fly URL.

**The owner's last message before this brief was leaning toward CF+Fly but had
not yet said "go."** If you're picking this up, the immediate question to
resolve is: confirm host choice, then execute the migration plan.

---

## 8. Performance: estimated scan times

| Scenario | Before our work | After |
|---|---|---|
| 1 GB / 1-hr 1080p, in-browser path, deployed w/ headers | ~10–12 min | **~2 min** |
| 1 GB / 1-hr 1080p, server fallback | ~10–12 min | ~5–7 min, with live progress |
| 18 GB / 4K | hard failure | TOO_LARGE screen → user runs ffmpeg cmd → ~3 min |

The ~2 min figure assumes: in-browser extraction (~1–2 min), parallel scan
(~30 s for ~120 windows at concurrency 4).

---

## 9. Deferred / backlog items (explicitly NOT done, with reasons)

These were discussed and consciously postponed:

- **Silence-skipping** (~40% fewer ACRCloud calls): before sending a window to
  ACRCloud, do a cheap local RMS/energy check; skip silent or speech-only
  windows. Big cost + time win on talking-head content. ~1 hr of work,
  browser-only, no API changes. **User paused this to focus on hosting.**
- **Web Worker for `decodeAudioData`** — keeps UI responsive on huge files /
  mobile. Deferred.
- **Coarse-then-fine scanning** — 60 s windows first, refine around matches.
- **Desktop helper Flavor B/C** — npx CLI or Electron/Tauri app for 18 GB users
  who aren't Terminal-comfortable. Flavor A (copy-paste cmd) shipped instead;
  build B/C only if demand data justifies it.
- **Real replacement-track catalog** — currently a 5-item static stub. Owner
  confirmed they want a real licensed catalog eventually (needs search, filters,
  audio preview).
- **Engine evaluation** — owner is *evaluating* ACRCloud, not locked in.
  Alternatives discussed: AudD (cheaper, similar), AcoustID+MusicBrainz (free,
  limited catalog), Pex (enterprise, UGC coverage), YouTube Content ID
  (partners only). Keep the engine behind the `useIdentifyAudioWindow` contract
  so swapping is a server-only change.
- **Automated tests** — none exist. Real gap. Suggested: tests for the scan
  loop, `extractSnippet`, the server route + rate limiter.
- **Refactor `Home.tsx`** — it's ~550 lines holding the whole app. Could extract
  `useScan()` / `useFileProcessor()` hooks and split `audio.ts`. Deferred as
  pure-shape churn with regression risk until tests exist.

---

## 10. Known limitations / honest caveats

1. **Cancellation is "stop dispatching new work," not "abort the in-flight HTTP
   request."** Lag is ~1–2 s (until the current ACRCloud call resolves).
   Acceptable; could thread an AbortSignal through TanStack mutation later.
2. **Rate limiter is in-memory** — fine for single-instance; needs Redis if
   scaling horizontally.
3. **Risk thresholds are crude** (count-based: 0 / 1–2 / 3+). A better signal is
   matched-seconds ÷ total-seconds, since 3 matches in a 10-min video ≠ 3 in a
   30-sec clip. Not yet implemented.
4. **No auth on any endpoint.** ACRCloud calls cost money; an open
   `/api/acr/identify` is a wallet-attack surface. The rate limiter on
   `/audio/extract` helps but `/acr/identify` is unprotected. Worth addressing
   before public launch.
5. **No content-type sniffing** on `/audio/extract` — it trusts the extension
   allowlist and lets ffmpeg reject garbage (wastes CPU but safe).
6. **Parallel scan (concurrency 4) can hit ACRCloud rate limits faster** than
   the old sequential approach — watch the plan's per-minute quota.

---

## 11. How to run locally

```bash
pnpm install
# build the generated libs first if typecheck complains about missing dist:
#   (cd lib/api-client-react && npx tsc) ; (cd lib/api-zod && npx tsc)

# backend
pnpm --filter @workspace/api-server run dev

# frontend (needs PORT + BASE_PATH env)
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/clipcleaner run dev
```
Typecheck: `pnpm --filter @workspace/clipcleaner typecheck` and
`pnpm --filter @workspace/api-server run typecheck`.
Build the SPA: `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/clipcleaner build`.

---

## 12. Suggested next actions (in priority order)

1. **Resolve hosting** — confirm Cloudflare Pages + Fly.io (or alternative),
   then execute the §7 migration plan. This is the live, blocking decision.
2. **Add auth / protect `/api/acr/identify`** before any public exposure.
3. **Silence-skipping** — highest-leverage perf/cost win still on the table.
4. **Replacement-track catalog** — turn the stub into something real if that's
   part of the product story.
5. **Tests** — at least the scan loop, `extractSnippet`, and the server routes.
6. **Re-evaluate risk scoring** (matched-seconds ratio).

---

## 13. Working style notes (for continuity)

- The owner is a solo founder, semi-technical, **comfortable with the command
  line**, prefers plain-language explanations with honest tradeoffs over jargon.
- They value being told when something is a bad idea (e.g., I talked them out of
  making users manually export audio from CapCut as the *primary* flow, and out
  of an all-Cloudflare setup that would force dropping the server fallback).
- Work cadence: small, reviewable commits, each typechecked + built before push.
- Branch: `claude/clip-cleaner-review-DfG4z`. Repo:
  `lazoladidiza-eng/replitaccount`. Nothing merged to main yet; no PR opened yet.
- Be frugal and direct. Recommend, don't just enumerate. Confirm before
  outward-facing / irreversible actions.
