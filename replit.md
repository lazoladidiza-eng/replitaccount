# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- **ClipCleaner** (`artifacts/clipcleaner`, preview `/`): React/Vite prototype for YouTube copyright pre-checks. Supports media upload, server-side audio extraction/normalization, 10-second window scanning, risk display, and replacement-track suggestions.
- **API Server** (`artifacts/api-server`, preview `/api`): Express backend. Includes health routes, ClipCleaner ACRCloud proxy endpoints, and server-side ffmpeg audio extraction.
- **Canvas** (`artifacts/mockup-sandbox`, preview `/__mockup`): Design/mockup sandbox.

## ClipCleaner API Notes

- ACRCloud credentials must be configured as environment secrets before live scans work:
  - `ACR_ACCESS_KEY`
  - `ACR_ACCESS_SECRET`
  - Optional: `ACR_HOST` (defaults to `identify-eu-west-1.acrcloud.com`)
- The browser never receives ACRCloud secrets. It sends base64-encoded mono WAV snippets to `/api/acr/identify`; the backend signs and forwards each request to ACRCloud.
- ClipCleaner has two audio-extraction paths:
  1. **In-browser (preferred)**: `ffmpeg.wasm` runs on the user's device, the video is never uploaded. Only available when the page is cross-origin isolated (`window.crossOriginIsolated === true`), which requires the `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless` headers on the SPA shell. `artifacts/clipcleaner/server.mjs` (used in production by the Replit `web` service) sends both; the Vite dev/preview server also sets them via the plugin in `vite.config.ts`.
  2. **Server fallback**: media files up to 500 MB are posted to `/api/audio/extract` as raw binary. The backend uses system `ffmpeg` to extract mono 16 kHz WAV audio. Per-IP rate limit: 6 requests/minute.
- **Replit preview caveat**: Replit's editor preview loads the app inside an iframe whose parent doesn't grant `cross-origin-isolated` to children. Inside that iframe, `crossOriginIsolated` is `false` regardless of headers, so the in-browser path can't activate and every video uploads via the server fallback (capped at 500 MB). The Home page detects this and shows an "Open in new tab" banner; opening the same URL as a top-level document gets the speed boost. Deployed Replit apps (and any non-iframed host) are unaffected.
- If credentials are missing, `/api/acr/status` returns a clear not-configured state and the frontend refuses to start a scan (no point spamming ACRCloud calls that will all 503).

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/clipcleaner run dev` — run ClipCleaner locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
