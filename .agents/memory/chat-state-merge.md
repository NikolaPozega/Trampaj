---
name: Chat state merge pattern
description: fetchConversations must merge incoming server data with local state, not replace — full replace causes race conditions that wipe conversations and messages.
---

## The rule
`fetchConversations` (and any polling/refresh) must MERGE server data into local state, not replace it entirely.

**Why:** Two race conditions were causing silent failures:

1. **Conversation creation race**: User presses "Pošalji poruku" → `getOrCreateConversation` (POST) starts → `router.push` immediately → chat screen mounts → `useFocusEffect` calls `fetchConversations` (GET) → GET completes before POST → returns empty list → `setConversations([])` wipes the in-flight conversation → screen stuck at "Učitavanje...".

2. **Message send race**: User sends message → optimistic `temp_` message added to state → polling GET fires (was already inflight before POST /messages) → GET returns without the new message → `setConversations` replaces state → optimistic message disappears.

## How to apply
In `fetchConversations` `setConversations` updater:
1. Map incoming server convs (merge messages: server msgs + any local `temp_` not yet on server)
2. Keep `prev` conversations whose IDs are NOT in incoming (locally-created, not yet server-confirmed)
3. Preserve `dealShown` and `escrowStatus` from local state

In chat screen `useEffect` that calls `getOrCreateConversation`:
- Include `token` as dependency (not just `listingId`) — token comes from AsyncStorage async and may be null on first render.

## Also
Add 8s timeout with retry button on the `!liveConv` loading state — prevents users from being stuck at "Učitavanje..." forever if both creation attempts fail.
