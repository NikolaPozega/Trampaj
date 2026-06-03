---
name: Push token race condition
description: Why DELETE push token was removed from logout and how registerPushToken is now structured
---

## The race condition

`logout()` fired `DELETE /push/token` as **fire-and-forget** (not awaited). When the user quickly logged back in:

1. Logout → DELETE fires (in-flight)
2. Login → POST new token → saved in DB
3. DELETE arrives late → sets `push_token = null`

Result: all users had `push_token = null` in DB even after logging in with APK.

## Fix (AuthContext.tsx)

- **Removed** `DELETE /push/token` from `logout()` entirely. There is no need to delete it — the next login always overwrites it. Race condition is gone.
- **Extracted** `registerPushToken(authToken)` helper: calls `setupNotifications()` → `getExpoPushToken()` → `POST /api/push/token`. Used by ALL login paths.
- **Added AppState listener**: every time app comes to `"active"` state while logged in, re-registers token. Handles: first run after APK install, expired tokens, missed registrations.
- **Fixed `loginWithToken`** (biometry path): was missing push registration entirely.

**Why:** push notifications only work in native APK build (not Expo Go SDK 53+). Tokens must survive logout/login cycles.

**How to apply:** Never DELETE push token on logout. Always use `registerPushToken()` for all login paths. AppState listener is the safety net for any missed registration.
