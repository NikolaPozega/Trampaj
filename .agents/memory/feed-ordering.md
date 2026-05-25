---
name: Feed ordering & personalization
description: How listings should be sorted in the home feed (index.tsx)
---

## Rule
- **All users**: newest listings first (sort by `createdAt` descending).
- **Logged-in users**: personalized ranking on top of recency:
  1. Extract keywords from the user's own posted listings (titles, descriptions, categories).
  2. Extract keywords from the user's previous search queries (stored locally).
  3. Boost listings that match those keywords higher in the feed.

## Why
User explicitly requested this as the product spec for feed ordering.

## How to apply
When implementing: pull search history from AsyncStorage (key TBD), extract keywords from `isMine` listings in context, score each listing by keyword overlap, then sort by `(score DESC, createdAt DESC)`.
