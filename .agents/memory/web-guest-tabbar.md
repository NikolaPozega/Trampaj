---
name: Web guest tab bar behavior
description: Tab bar hidden for unauthenticated users on web; AdBanner serves as guest bottom UI; auto-seed on empty DB.
---

# Web Guest Tab Bar

**Rule:** Tab bar (`tabBarStyle: user ? {...} : { display: "none" }`) is intentionally hidden for unauthenticated users. Each tab button also returns null for guests (`tabBarButton: user ? undefined : () => null`).

**Why:** App drives guest conversion — guests see AdBannerSlot (size="bottom", position absolute bottom:0) as their only bottom UI. Tab bar appears after login.

**How to apply:** When writing E2E tests, test tab navigation only while logged in. Guest flow uses header "Prijava"/"Registracija" links instead of tabs. Do NOT add bottom offset to the AdBanner for web — there is no tab bar to offset against.

# Auto-seed on empty DB

**Rule:** `seedIfEmpty()` runs in `index.ts` on server startup; inserts 8 demo listings owned by `TrampaDemo` user (ID `00000000-0000-0000-0000-000000000001`) only when `listings` table is empty.

**Why:** Production DB starts empty; SAMPLE_LISTINGS (client-side fallback with IDs like "sample_1") cause chat 404s since they don't exist in DB. Real DB listings have UUID IDs → chat works.

**How to apply:** Never remove the `seedIfEmpty()` call. It is idempotent (skips if any listings exist). When testing chat, ensure DB has at least one listing not owned by the logged-in user.

# Sample listing guard

Listing detail screen checks `listing.id.startsWith("sample_")` before calling `getOrCreateConversation`. Shows Alert "Demo oglas" instead of navigating to chat (preventing a 404).
