---
name: Expo splash screen fix
description: expo-router and expo-splash-screen use separate native counters — mixing them causes permanent blue splash screen in Expo Go.
---

## The rule
- Import `SplashScreen` from `"expo-router"`, **not** from `"expo-splash-screen"`.
- Never call `SplashScreen.preventAutoHideAsync()` in `_layout.tsx` — expo-router calls `internalPreventAutoHideAsync()` internally.
- Use `SplashScreen.hide()` (not `hideAsync`) to imperatively clear the splash.
- Add a 3-second `setTimeout(() => SplashScreen.hide(), 3000)` as a failsafe in `useEffect`.

## Why
expo-router uses `SplashModule.internalPreventAutoHideAsync()` (internal counter) and `SplashModule.internalMaybeHideAsync()` (internal clear). The standalone `expo-splash-screen` package uses `SplashModule.preventAutoHideAsync()` (separate counter). Calling both prevents means only expo-router's internal clear fires; the regular counter stays set and the splash stays visible forever — user sees a permanent blue splash screen.

## How to apply
Any time `_layout.tsx` (or any root layout in an Expo Router project) needs splash screen control, use:
```ts
import { SplashScreen } from "expo-router";
// inside useEffect:
SplashScreen.hide();
// as failsafe:
setTimeout(() => SplashScreen.hide(), 3000);
```
Do NOT `import * as SplashScreen from "expo-splash-screen"` in the same file.
