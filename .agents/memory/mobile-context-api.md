---
name: Mobile context API pattern
description: How ListingsContext and ChatContext connect to the backend API
---

## API_BASE

Both ListingsContext and ChatContext use:
```typescript
const API_BASE = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
  : "/api";
```

## ListingsContext

- Uses `useAuth()` to get `token` and `user` (safe because ListingsProvider is inside AuthProvider)
- `myName = user?.username ?? "Korisnik"` — no longer stored in AsyncStorage
- `setMyName` is a no-op (kept for interface compat; username is set at registration)
- `isMine = listing.userId === user?.id` — computed on mobile using `userId` field returned by API
- Falls back to SAMPLE_LISTINGS when API returns empty array OR when offline — prevents blank browse screen
- On user change (login/logout) re-fetches listings + saved + blocked from API
- All write operations (add/update/delete/save/block/review) are optimistic: update local state first, then POST to API
- `refreshListings()` is exposed in context for pull-to-refresh

## ChatContext

- Only active when token is present; conversations cleared on logout
- `getOrCreateConversation` is now `async`, returns `Promise<Conversation | null>`
- Callers in listing/[id].tsx use `void getOrCreateConversation(...)` (fire-and-forget before navigation)
- Chat screen's useEffect uses fire-and-forget since conversation appears via polling
- Polls every 5 seconds (POLL_INTERVAL) when app is active
- Optimistic message adds use temp id `temp_${Date.now()}`, replaced with real id on API success
- No more auto-reply simulation — real messages come from the other user via polling
- `sendMessage` and `sendSpecialMessage` are now async (`Promise<void>`)

## DB push

Run `pnpm --filter @workspace/db run push` to push schema changes to dev DB.
After any lib (db package) change, run `pnpm run typecheck:libs` to rebuild declarations before typechecking the API server.
