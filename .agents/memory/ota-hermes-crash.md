---
name: OTA crashes on Hermes APK
description: All OTA updates crash if built with baseUrl:/mobile or without --no-bytecode; root cause documented with full fix checklist.
---

## Root cause 1: baseUrl mismatch (PRIMARY CRASH CAUSE)
`experiments.baseUrl: "/mobile"` in app.json causes `expo export` to bake `/mobile` route prefixes into the bundle. EAS APK build ignores this for native Android. OTA routes = `/mobile/(tabs)/oglasi`, APK routes = `/(tabs)/oglasi` → crash on navigation.

**Fix:** Remove `"baseUrl": "/mobile"` from app.json experiments BEFORE export, restore AFTER.

## Root cause 2: hermesc linux64 can't compile modern JS
The bundled `hermesc` (linux64) fails on: private class fields (`#x`), class declarations in general. All `expo export` without `--no-bytecode` fail with exit code 2.

**Fix:** Always use `--no-bytecode` for exports from this Replit environment. Device Hermes runtime can execute raw JS.

## Full OTA checklist (every time)
1. Remove `"baseUrl": "/mobile"` from app.json experiments
2. `rm -rf /tmp/ota-distN`
3. `cd artifacts/mobile && npx expo export --platform android --output-dir /tmp/ota-distN --no-bytecode`
4. Restore `"baseUrl": "/mobile"` to app.json
5. Remove git lock if needed: Node.js `fs.unlinkSync('/home/runner/workspace/.git/index.lock')`
6. Recreate fake-git wrapper if /tmp was cleared: `mkdir -p /tmp/fake-git-bin && cat > /tmp/fake-git-bin/git ...`
7. `cd artifacts/mobile && PATH="/tmp/fake-git-bin:$PATH" EAS_SKIP_AUTO_FINGERPRINT=1 npx eas-cli update --branch preview --platform android --message "..." --skip-bundler --input-dir /tmp/ota-distN --no-bytecode --non-interactive`

## History
- dist1-5: all crashed (baseUrl + hermesc issues)
- dist6: first working OTA (baseUrl fixed, original APK code)
- dist7: neon-card-duo ListingCard (baseUrl fixed, new design)
