---
name: OTA update from Replit
description: Full workflow for pushing Expo OTA updates (EAS Update) from the Replit environment, including the vcs.js patch required for the gitCommitHash "$" bug.
---

## The rule
Never use plain `eas update` or `npx eas-cli` — they hang. Never run `pnpm exec eas` — also hangs. Use `node .../global/eas-cli/bin/run` directly, wrapped in background process with explicit timeout.

**Why hermesc:** hermesc linux64 binary in react-native@0.81.5 is too old; always use `--no-bytecode`.
**Why vcs patch:** EAS CLI v20 `getCommitHashAsync()` base class returns `undefined`, then the GraphQL mutation sends literal `"$"` as gitCommitHash — EAS API rejects it. Must patch BOTH global and monorepo-local copies every session (patches don't persist).
**Why background:** bash tool silently kills processes that produce no output for ~30s; pipe to `head` + use `& wait` pattern.

## Full workflow

```bash
# 1. Remove baseUrl from app.json
cd artifacts/mobile && python3 -c "
import json
with open('app.json') as f: d=json.load(f)
d['expo']['experiments'].pop('baseUrl',None)
with open('app.json','w') as f: json.dump(d,f,indent=2,ensure_ascii=False)
"

# 2. Export bundle
EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN EXPO_PUBLIC_REPL_ID=$REPL_ID \
  EXPO_PUBLIC_OPENAI_API_KEY=$OPENAI_API_KEY \
  npx expo export --no-bytecode --output-dir /tmp/ota-distN --platform android

# 3. Restore baseUrl
python3 -c "
import json
with open('app.json') as f: d=json.load(f)
d['expo']['experiments']['baseUrl']='/mobile'
with open('app.json','w') as f: json.dump(d,f,indent=2,ensure_ascii=False)
"

# 4. Create fake-git (catch-all, returns 40-char hash)
mkdir -p /tmp/fake-git-bin
cat > /tmp/fake-git-bin/git << 'EOF'
#!/bin/sh
echo "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
exit 0
EOF
chmod +x /tmp/fake-git-bin/git

# 5. PATCH vcs.js in BOTH global and local eas-cli copies (critical!)
for F in \
  /home/runner/workspace/.config/npm/node_global/lib/node_modules/eas-cli/build/vcs/vcs.js \
  /home/runner/workspace/node_modules/.pnpm/eas-cli@20.0.0_@types+node@25.6.2_typescript@5.9.3/node_modules/eas-cli/build/vcs/vcs.js; do
  python3 -c "
import re
with open('$F') as f: c=f.read()
old='    async getCommitHashAsync() {\n        return undefined;\n    }'
new='    async getCommitHashAsync() {\n        return '"'"'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'"'"';\n    }'
c2=c.replace(old,new,1)
with open('$F','w') as f: f.write(c2)
print('patched' if c2!=c else 'already patched or no match', '$F')
  "
done
# Also patch git.js VCS client
for F in \
  /home/runner/workspace/.config/npm/node_global/lib/node_modules/eas-cli/build/vcs/clients/git.js \
  /home/runner/workspace/node_modules/.pnpm/eas-cli@20.0.0_@types+node@25.6.2_typescript@5.9.3/node_modules/eas-cli/build/vcs/clients/git.js; do
  python3 -c "
with open('$F') as f: c=f.read()
old='''    async getCommitHashAsync() {
        try {
            return (await (0, spawn_async_1.default)('git', ['rev-parse', 'HEAD'], {
                cwd: this.maybeCwdOverride,
            })).stdout.trim();
        }
        catch {
            return undefined;
        }
    }'''
new='''    async getCommitHashAsync() {
        return 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    }'''
c2=c.replace(old,new,1)
with open('$F','w') as f: f.write(c2)
print('patched' if c2!=c else 'already/no match', '$F')
  "
done

# 6. Push OTA (background + head pipe to avoid silent kill)
cd artifacts/mobile && PATH="/tmp/fake-git-bin:$PATH" \
  EAS_SKIP_AUTO_FINGERPRINT=1 EXPO_TOKEN="$EXPO_TOKEN" CI=1 \
  node /home/runner/workspace/.config/npm/node_global/lib/node_modules/eas-cli/bin/run \
  update --branch preview --platform android --skip-bundler \
  --input-dir /tmp/ota-distN --no-bytecode --non-interactive \
  --message "distN: description" 2>&1 | head -60 &
PID=$!; sleep 90
if kill -0 $PID 2>/dev/null; then kill $PID 2>/dev/null; fi
wait $PID 2>/dev/null
```

## Important notes
- fake-git hash must be EXACTLY 40 chars — more than 40 is rejected by EAS API
- `EAS_GIT_COMMIT_HASH` env var is NOT picked up by eas-cli v20 (tried, doesn't work)
- `npx eas-cli`, `pnpm exec eas`, `/home/runner/workspace/node_modules/.bin/eas` — all hang after "Found eas-cli in your monorepo dependencies"; only `node .../global/.../bin/run` works
- Must re-apply patches every session (node_modules changes don't persist)

## Latest OTA
- dist12 pushed 2026-06-04: crash null guard + image http filter + AI tag prompt + search ranking bypass during search
- dist13 pushed 2026-06-04: edit modal - all fields (topup/flexibility/cashFallback/deadline) + AI tag regeneration on save
- dist16 pushed 2026-06-05: APK v1.1.0 initial OTA baseline (runtimeVersion 1.1.0, branch preview, update group 0e63b1e9-c929-4ba6-b0fd-93b13d44d878)
