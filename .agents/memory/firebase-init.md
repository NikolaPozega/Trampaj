---
name: Firebase Admin SDK init
description: How Firebase is initialized and how to recover when the secret is missing/broken
---

# Firebase Admin SDK Init Pattern

## Working solution
- `FIREBASE_SERVICE_ACCOUNT` is stored as a **shared env var** (not a Replit secret) because Replit's secret input is single-line and truncates multi-line JSON
- Value is compact JSON (JSON.stringify output — no pretty-print newlines)
- Set via `setEnvVars({ values: { FIREBASE_SERVICE_ACCOUNT: JSON.stringify(parsed) } })` in code_execution sandbox, reading from the attached JSON file

## Code handles two formats
1. Full JSON (starts with `{`) — parsed directly
2. Raw PEM key string (contains "BEGIN") — wrapped with hardcoded projectId/clientEmail

**Why:** Replit secrets UI is single-line; pasting multi-line JSON or PEM truncates after first newline. Using `setEnvVars` (env var, not secret) bypasses this.

**How to recover:** User re-attaches the Firebase service account JSON file → agent reads it in code_execution → JSON.stringify → setEnvVars → restart API server.

## Project details
- projectId: trampaj-8faed
- clientEmail: firebase-adminsdk-fbsvc@trampaj-8faed.iam.gserviceaccount.com
