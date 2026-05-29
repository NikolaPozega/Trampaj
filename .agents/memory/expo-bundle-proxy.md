---
name: Expo bundle proxy fix
description: How to make Metro bundle URLs work through Replit's shared proxy for Expo apps in a pnpm monorepo.
---

## The problem

In a pnpm monorepo, `"main": "expo-router/entry"` in package.json produces a bundle URL with `@` and `+` characters (pnpm virtual store path) that break the Replit proxy.

## The fix (three parts)

### 1. Clean entry point
- Create `artifacts/mobile/index.js` with `import 'expo-router/entry';`
- Set `"main": "index"` in `artifacts/mobile/package.json`
- Result: bundle URL path becomes `/artifacts/mobile/index.bundle` (no `@` chars)

### 2. artifact.toml paths
- Add `/artifacts/mobile` as a second path in `[[services]] paths`:
  ```toml
  paths = [ "/mobile", "/artifacts/mobile" ]
  ```
- This tells the Replit shared proxy to route bundle requests to Metro (port 18115)

### 3. EXPO_PACKAGER_PROXY_URL
- Keep as `https://$REPLIT_DEV_DOMAIN/mobile` in the dev script
- NOTE: This env var only replaces the origin, NOT adds a path prefix — path prefix in the URL is ignored by Expo CLI

## Key insight: Replit shared proxy behavior

The shared proxy forwards the **FULL path** to the backend service — it does NOT strip the `/mobile` prefix. So:
- `/mobile/status` → Metro receives `/mobile/status` → serves Metro web HTML (not "packager-status:running")
- `/artifacts/mobile/index.bundle` → Metro receives `/artifacts/mobile/index.bundle` → serves native bundle ✓

Metro computes module names relative to the watchFolders root (workspaceRoot), so `index.js` at `artifacts/mobile/index.js` gets the module name `artifacts/mobile/index` → bundle URL path `/artifacts/mobile/index.bundle`.

## Expo-dev-domain vs regular dev domain

- `$REPLIT_EXPO_DEV_DOMAIN` (`.expo.riker.replit.dev`) — also routes through shared proxy; same behavior
- `$REPLIT_DEV_DOMAIN` (`.riker.replit.dev`) — the regular dev domain; also uses shared proxy
- Both return 404 unless the path matches an artifact's registered `paths` in artifact.toml

**Why:** Use `paths = ["/mobile", "/artifacts/mobile"]` so both the manifest endpoint (`/mobile/`) and the bundle download (`/artifacts/mobile/index.bundle`) are routed correctly.
