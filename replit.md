# Trampa

Mobilna aplikacija za trampu — korisnici postavljaju predmete koje nude i traže što žele u zamjenu.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo + React Native (Expo Router)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (not yet used)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/mobile/` — Expo mobile app
- `artifacts/mobile/app/(tabs)/` — Browse, Post, Profile tabs
- `artifacts/mobile/app/listing/[id].tsx` — Listing detail screen
- `artifacts/mobile/context/ListingsContext.tsx` — state management (AsyncStorage)
- `artifacts/mobile/components/` — ListingCard, CategoryPill, EmptyState
- `artifacts/mobile/constants/colors.ts` — design tokens (terracotta #E85D25)

## Architecture decisions

- Frontend-only: uses AsyncStorage for persistence, no backend needed for first build
- Sample listings pre-loaded on first run to show the UI populated
- CI=1 + NODE_OPTIONS=--dns-result-order=ipv4first in dev script to fix Replit workflow port detection
- 3-tab navigation: Oglasi (browse), Objavi (post), Profil (my listings)

## Product

- Browse all active barter listings with category filters and search
- Post new items with description and what you want in return
- View listing detail and send a trade offer
- Manage your own listings (mark as traded, delete)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always use `NODE_OPTIONS=--dns-result-order=ipv4first` in the mobile dev script — Metro defaults to IPv6 binding on NixOS, which breaks the Replit port health check
- CI=1 is required to keep Metro alive in non-interactive mode in the Replit workflow runner

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
