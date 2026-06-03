---
name: Firebase FCM setup for Android push
description: Why google-services.json is required and how it's configured
---

## Problem

`getExpoPushTokenAsync` silently returns null on Android if `google-services.json` is not included in the APK. The APK must be rebuilt — OTA update alone is not enough for native module changes.

## Setup

- Firebase project: `trampaj-8faed` (console.firebase.google.com)
- Android package: `hr.trampaj.app` (all lowercase — Firebase was registered with `Hr.trampaj.app`, corrected in the JSON file)
- File: `artifacts/mobile/google-services.json`
- app.json: `android.googleServicesFile: "./google-services.json"`

**Why:** FCM (Firebase Cloud Messaging) is required for Android push notifications. Expo's `getExpoPushTokenAsync` contacts Expo's push service which uses FCM internally. Without `google-services.json`, FCM registration fails and no ExponentPushToken is issued.

**How to apply:** Any future APK rebuild automatically picks up `google-services.json` via `app.json`. If Firebase project changes, replace the file and rebuild APK.
