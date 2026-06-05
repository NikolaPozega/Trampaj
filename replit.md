# Trampaj.hr

Platforma za trampu predmeta — mobilna app + web + admin.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — pokreni API server (port 8080)
- `pnpm run typecheck` — typecheck svih paketa
- `pnpm run build` — typecheck + build svih paketa
- `pnpm --filter @workspace/api-spec run codegen` — regeneriraj API hookove i Zod sheme iz OpenAPI spec-a
- `pnpm --filter @workspace/db run push` — push DB schema promjena (samo dev)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo + React Native (Expo Router)
- Web: React + Vite + Wouter
- Admin: React + Vite
- API: Express 5 (port 8080)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Design tokens

- Pozadina: `#08152E` (tamno navy)
- Akcent: `#F5C100` (žuta)
- Sekundarni akcent: `#38BDF8` (plava)
- Tekst: `#F0F4FF`
- Mutni tekst: `#7A90B0`
- Neon obrub na karticama oglasa (cijanova/žuta gradijent) — namjerno, ne dirать

## Gdje je što

- `artifacts/mobile/` — Expo mobilna app (Android + iOS + web preview)
- `artifacts/mobile/app/(tabs)/` — tabovi: Oglasi, Objavi, Profil
- `artifacts/mobile/app/inbox.tsx` — inbox poruka
- `artifacts/mobile/app/chat/[listingId].tsx` — chat ekran
- `artifacts/mobile/context/` — ListingsContext, ChatContext, AuthContext
- `artifacts/web/` — trampaj.hr web stranica
- `artifacts/admin/` — admin panel (moderacija, statistike, push)
- `artifacts/api-server/` — Express API

## Web stranica (artifacts/web) — PLAN

**Trenutno:** Landing "zastor" stranica — prikazuje se dok se gradi puna web stranica.

**Kad se makne zastor (finalna web stranica treba biti):**
- Vizualno identično appu: navy/žuta paleta, isti stil kartica, isti fontovi
- Browse svih aktivnih oglasa (grid prikaz, isti kao app feed)
- Detalj oglasa — prikaz svih info + telefonski broj vlasnika
- Klikom na "Pošalji poruku" / chat → redirect na skidanje app (App Store / Google Play)
- BEZ mogućnosti prijave / registracije
- BEZ chata na webu
- Pravne stranice: `/terms` i `/privacy` (već postoje, ostaju)
- Pretraživanje i filtriranje po kategorijama (kao u appu)

## Admin panel (artifacts/admin)

- Dizajn: futuristic neon borders, tamna tema, gust prikaz podataka — **ne mijenjati dizajn dok ne dođe puni redesign**
- Funkcije: moderacija oglasa (approve/reject), korisnici, statistike, push notifikacije, early adopters, social posting, monitoring

## Mobilna app — arhitektura

- PostgreSQL + Drizzle ORM za sve podatke
- Svi oglasi prolaze kroz moderaciju (pending → approved/rejected)
- Firebase FCM za push notifikacije (Android)
- Stripe za escrow plaćanja dostave
- AI (OpenAI) za analizu slika, generiranje tagova, moderaciju sadržaja
- Semantički matching oglasa (server-side + local)
- Chat s "handshake" mehanizmom za dogovor trampe
- OTA update via EAS (expo-updates)

## User preferences

- Minimalne promjene — ne dodavati ništa što nije traženo
- NeonFrame animacija na KARTICAMA je OK, na layoutu (cijeli ekran) — uklonjena
- Web landing = zastor, ne dodavati sadržaj dok se eksplicitno ne kaže
- Greške priznavati direktno bez izlike
- Hrvatski jezik u komunikaciji

## Gotchas

- Uvijek koristiti `NODE_OPTIONS=--dns-result-order=ipv4first` u mobile dev skripti
- CI=1 je obavezno za Metro u non-interactive modu
- API server je na portu 8080 (ne 5000!)
- Drizzle join spread koristi `getTableColumns()`, ne direktno table spread
- Firebase Admin SDK init MORA biti iz Replit secreta (multi-line JSON private key)
- OTA update: koristiti `expo export --no-bytecode` + `eas update --skip-bundler`; hermesc linux64 je broken

## Pointers

- Vidi `pnpm-workspace` skill za workspace strukturu i TypeScript setup

## Latest APK Build

- **v1.1.0** (preview/Android): https://expo.dev/accounts/nikola1987/projects/mobile/builds/aefb0805-c501-4164-bd76-82b348e843d2
  - Submitted 2026-06-05 with `EAS_NO_VCS=1`, `hermesEnabled: false` (bypass hermesc linux64 private-field bug from @sentry/react-native@8.x)
