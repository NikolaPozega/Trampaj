---
name: Firebase FCM setup for Android push
description: How push notifications are sent — Firebase Admin SDK directly (not Expo relay)
---

## Architecture (current)

Server sends push **directly via Firebase Admin SDK** (`firebase-admin` npm package), bypassing Expo's push relay service.
Mobile registers a **raw FCM device token** via `Notifications.getDevicePushTokenAsync()` (not Expo token).

**Why switched:** Expo's push relay (`exp.host/--/api/v2/push/send`) requires FCM credentials uploaded to EAS. That failed with `InvalidCredentials`. Direct Firebase Admin SDK needs only a service account JSON env var — simpler and more reliable.

## Firebase project

- Project: `trampaj-8faed` (console.firebase.google.com)
- Android package: `hr.trampaj.app`
- Service account: `firebase-adminsdk-fbsvc@trampaj-8faed.iam.gserviceaccount.com`
- Env var: `FIREBASE_SERVICE_ACCOUNT` (shared) — full service account JSON

## Mobile side

- `artifacts/mobile/utils/notifications.ts` → `getDevicePushTokenAsync()` returns raw FCM token string
- `artifacts/mobile/google-services.json` — required in APK for FCM to work (native, not OTA)
- `app.json`: `android.googleServicesFile: "./google-services.json"`

## Server side

- `artifacts/api-server/src/routes/conversations.ts` — initializes `firebase-admin` once, sends via `admin.messaging().send()`
- Channel: `poruke`, priority: high, color: #F5C100

**How to apply:** If Firebase project changes, update `google-services.json` (rebuild APK needed) AND generate new service account JSON → update `FIREBASE_SERVICE_ACCOUNT` env var → redeploy server.
