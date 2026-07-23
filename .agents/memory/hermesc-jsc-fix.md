---
name: hermesc broken on EAS — real cause and fix
description: hermesc 0.12.0 placeholder in react-native npm does not support async arrow functions; fix is to build from source via EAS post-install hook
---

## Rule
The react-native npm package ships hermesc 0.12.0 as a PLACEHOLDER in `sdks/hermesc/linux64-bin/hermesc`. This binary does NOT support async arrow functions (`async event => {}`) and fails with "async functions are unsupported" on the Metro bundle.

DO NOT use jsEngine:"jsc" to work around this — react-native-worklets 0.5.1 links against `ReactAndroid::jsctooling` when JS_RUNTIME=jsc, and that CMake target does not exist in RN 0.81.5 (JSC was extracted to community package @react-native-community/javascriptcore which provides `jscruntimefactory` not `jsctooling`).

## Fix
`.eas-build-post-install.sh` in workspace root does:
1. Finds react-native in pnpm store via `cd artifacts/mobile && node -e "require.resolve('react-native/package.json')"`
2. Downloads source tarball from `https://github.com/facebook/hermes/tarball/{.hermesversion content}`
3. Builds with cmake targeting `hermesc` only (HERMES_ENABLE_DEBUGGER=False, HERMES_ENABLE_TOOLS=False, HERMES_BUILD_SHARED_JSI=False)
4. Places binary at `$RN_PATH/ReactAndroid/hermes-engine/build/hermes/bin/hermesc` (PathUtils.kt option-2, priority over placeholder)
5. Caches to `/tmp/hermesc-cache` (configured via eas.json cache.paths key "hermesc-rn081-v1")

**Why:** PathUtils.kt (in @react-native/gradle-plugin) resolution order:
1. configured `hermesCommand` in react{} Gradle extension
2. built-from-source at `node_modules/react-native/ReactAndroid/hermes-engine/build/hermes/bin/hermesc` ← we target this
3. placeholder at `node_modules/react-native/sdks/hermesc/linux64-bin/hermesc` (0.12.0 — broken)

**Why June builds worked, July failed:** pnpm lockfile key for react-native changed in July (added @react-native-community/cli to peer deps chain) → EAS created fresh pnpm store entry → fresh 0.12.0 placeholder used.
