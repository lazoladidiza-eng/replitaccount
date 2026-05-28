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
- **GPS Share** (`artifacts/gps-share-app`): Flutter MVP for consent-based live GPS sharing (Android-first, Firebase Auth + Firestore). Self-contained — invisible to pnpm. See `artifacts/gps-share-app/README.md` for setup.

## ClipCleaner API Notes

- ACRCloud credentials must be configured as environment secrets before live scans work:
  - `ACR_ACCESS_KEY`
  - `ACR_ACCESS_SECRET`
  - Optional: `ACR_HOST` (defaults to `identify-eu-west-1.acrcloud.com`)
- The browser never receives ACRCloud secrets. It sends base64-encoded mono WAV snippets to `/api/acr/identify`; the backend signs and forwards each request to ACRCloud.
- Media files are posted to `/api/audio/extract` as raw binary. The backend uses system `ffmpeg` to extract mono 16kHz WAV audio, avoiding browser `SharedArrayBuffer` / ffmpeg.wasm limitations in preview iframes and mobile browsers.
- If credentials are missing, `/api/acr/status` returns a clear not-configured state and the frontend still allows testing upload/extraction flow.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/clipcleaner run dev` — run ClipCleaner locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
