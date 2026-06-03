---
name: Image upload architecture
description: How listing images are uploaded to GCS and served publicly in Trampaj
---

## Flow
1. Mobile picks image (local `file://` URI)
2. On submit: `compressImage(uri, 1200, 0.85)` → base64
3. `POST /api/uploads/image` with `{ base64Image, mimeType }` + Bearer token
4. Server uploads to GCS bucket (`DEFAULT_OBJECT_STORAGE_BUCKET_ID`) with `public: true`
5. Returns `{ url: "https://storage.googleapis.com/<bucket>/listings/<uuid>.jpg" }`
6. Public HTTPS URL stored in DB — visible to all users

## Server files
- `artifacts/api-server/src/lib/objectStorage.ts` — GCS client (Replit sidecar auth at 127.0.0.1:1106)
- `artifacts/api-server/src/lib/objectAcl.ts` — ACL helpers (copied from skill template)
- `artifacts/api-server/src/routes/uploads.ts` — the upload route

**Why:** Local `file://` URIs from expo-image-picker are only accessible on the poster's device; other users see a broken image. Server-side upload to GCS fixes this.

**How to apply:** If adding video or other media uploads, reuse the same `objectStorageClient.bucket(bucketId).file(path).save(buffer, { public: true })` pattern.

## Gotchas
- `objectStorage.ts` template had TS error: `response.json()` returns `unknown`, destructuring `signed_url` fails — cast to `{ signed_url: string }` first.
- `addListing` in ListingsContext was awaiting `Promise.all([refreshListings(), refreshMyListings()])` — changed to `void Promise.all(...)` so post returns immediately.
