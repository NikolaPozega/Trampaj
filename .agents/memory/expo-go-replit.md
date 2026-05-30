---
name: Expo Go connection on Replit
description: How to make Expo Go (phone app) connect to Metro dev server running inside Replit's shared proxy environment.
---

## The Problem

Replit's shared proxy routes requests by path. The API server is registered with `paths = ["/", "/api"]`, which intercepts ALL root requests — including the Expo Go manifest request (`GET /` with `Accept: application/expo+json`). Metro's `enhanceMiddleware` does NOT work when `Expo-Platform: android` header is present (Metro handles this request before the middleware runs).

## The Solution

Add an Expo manifest proxy route INSIDE the API server (`artifacts/api-server/src/app.ts`), **before** the landing page handler, that:
1. Detects Expo Go requests: `Accept: application/expo+json` OR `Expo-Platform` header
2. In development only (`process.env.NODE_ENV === "development"`), proxies `GET /` to Metro on `localhost:18115`
3. Falls through to the landing page otherwise

```typescript
app.get("/", (req, res, next) => {
  if (process.env.NODE_ENV !== "development") return next();
  const accept = req.headers["accept"] ?? "";
  const platform = req.headers["expo-platform"];
  if (!accept.includes("application/expo+json") && !platform) return next();

  const proxyReq = http.get(
    { hostname: "localhost", port: 18115, path: "/", headers: { ...req.headers, host: "localhost:18115" } },
    (proxyRes) => {
      res.statusCode = proxyRes.statusCode ?? 200;
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (v !== undefined) res.setHeader(k, v);
      }
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", () => next());
});
```

## Bundle URL

`EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN/mobile` in mobile dev script causes Metro to use the public dev domain as the bundle host. The `/mobile` suffix in EXPO_PACKAGER_PROXY_URL only replaces the host, not adding a path prefix. Resulting bundle URL: `https://[dev-domain]/artifacts/mobile/index.bundle` — this path must be registered in `artifact.toml` so the proxy routes to Metro port.

## artifact.toml paths (mobile)
```toml
paths = ["/mobile", "/artifacts/mobile"]
```

## Manifest format (Expo SDK 54+)

Metro returns the new EAS Updates manifest format (NOT classic):
- `runtimeVersion: "exposdk:54.0.0"` (not top-level `sdkVersion`)
- `launchAsset.url` (not `bundleUrl`)
- `extra.expoClient.sdkVersion: "54.0.0"`

Expo Go supports this format since SDK 50+.

## What DOESN'T work

- `enhanceMiddleware` in `metro.config.js` is bypassed when `Expo-Platform: android` is in headers
- `router = "expo-domain"` in artifact.toml does NOT bypass path routing in this environment
- `/_expo/manifest` endpoint is not needed (404 is expected)

**Why:** Metro's internal server handles `Expo-Platform` requests at a lower level before the enhanceMiddleware wrapper gets a chance to run.
