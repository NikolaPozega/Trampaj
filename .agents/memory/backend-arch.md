---
name: Backend architecture
description: Key decisions for the Drizzle ORM + PostgreSQL API server setup
---

## DB Schema

All new tables use `text("id").primaryKey()` with UUID values (randomUUID() server-side).
Junction tables (saved_listings, blocked_users) use `primaryKey({ columns: [...] })` in the table extras callback as an array: `(t) => [primaryKey(...)]`.

JSON fields (imageUris, nudimTags, trazimTags) are stored as `text` and serialized/deserialized in the API layer.

## Drizzle join pattern

When joining tables in `.select()`, do NOT spread the table object directly — it causes TS2345.
**Correct pattern:**
```typescript
import { getTableColumns } from "drizzle-orm";
const listingCols = getTableColumns(listingsTable);
const fields = { ...listingCols, userName: usersTable.username };
db.select(fields).from(listingsTable).innerJoin(...)
```

Then cast the result: `as ListingRow[]` where ListingRow is a plain interface matching the expected fields.

**Why:** Drizzle's `SelectedFields` type does not accept PgTable objects in a spread — it only accepts PgColumn and similar. `getTableColumns()` returns `{ [name]: PgColumn }` which is valid.

## Auth middleware

- `requireAuth` — reads `Authorization: Bearer <token>`, verifies JWT, attaches `req.userId` and `req.username`
- `optionalAuth` — same but doesn't reject unauthenticated requests
- Located at `artifacts/api-server/src/middlewares/auth.ts`
- JWT secret: `process.env["SESSION_SECRET"]`

## Routes

All routes mounted in `artifacts/api-server/src/routes/index.ts`.
Listings + saved + blocked endpoints in `listings.ts`.
Conversations + messages in `conversations.ts`.
Reviews in `reviews.ts`.
Blocked users in `blocked.ts`.
