#!/bin/bash
# hermesc-wrapper.sh — builds correct hermesc on first run, caches, then execs.
# Invoked by Gradle as `hermesCommand`. Android SDK cmake is already installed
# by the time this runs (configureCMake tasks precede createBundleJsAndAssets).

set -uo pipefail

CACHE="/tmp/hermesc-bin/hermesc"
TAG="[TRAMPAJ-HERMESC]"
log() { echo "$TAG $*" >&2; }

log "invoked (first arg: ${1:-<none>})"

# ── fast path: cached binary ──────────────────────────────────────────────────
if [ -f "$CACHE" ] && [ -x "$CACHE" ]; then
    log "cache hit → exec"
    exec "$CACHE" "$@"
fi

log "cache miss — building hermesc from source"

# ── locate cmake ──────────────────────────────────────────────────────────────
CMAKE=""

# Android SDK cmake (installed by Gradle before bundle task runs)
for VER in 3.22.1 3.28.3 3.31.6; do
    P="/home/expo/Android/Sdk/cmake/$VER/bin/cmake"
    if [ -f "$P" ] && [ -x "$P" ]; then CMAKE="$P"; break; fi
done

# Wait up to 120 s for Android SDK cmake (race with configure tasks)
if [ -z "$CMAKE" ]; then
    log "cmake not found yet, polling up to 120 s..."
    for i in $(seq 1 120); do
        sleep 1
        for VER in 3.22.1 3.28.3 3.31.6; do
            P="/home/expo/Android/Sdk/cmake/$VER/bin/cmake"
            if [ -f "$P" ] && [ -x "$P" ]; then CMAKE="$P"; break 2; fi
        done
    done
fi

# Last resort: system cmake
if [ -z "$CMAKE" ] && command -v cmake &>/dev/null; then
    CMAKE="$(which cmake)"
fi

# Last-last resort: download static cmake
if [ -z "$CMAKE" ]; then
    log "downloading cmake static binary"
    mkdir -p /tmp/cmake-static
    curl -fsSL --retry 3 --max-time 120 \
        "https://github.com/Kitware/CMake/releases/download/v3.28.3/cmake-3.28.3-linux-x86_64.tar.gz" \
        | tar xz -C /tmp/cmake-static --strip-components=1
    CMAKE="/tmp/cmake-static/bin/cmake"
fi

if [ ! -x "$CMAKE" ]; then
    log "ERROR: cannot find cmake"; exit 1
fi
log "cmake: $CMAKE — $("$CMAKE" --version | head -1)"

# ── find hermes version tag ───────────────────────────────────────────────────
# In pnpm on EAS: node_modules/react-native → .pnpm/.../node_modules/react-native
RN_SYMLINK="/home/expo/workingdir/build/node_modules/react-native"
if [ -e "$RN_SYMLINK" ]; then
    RN_DIR="$(readlink -f "$RN_SYMLINK" 2>/dev/null || echo "$RN_SYMLINK")"
else
    # Fallback search
    RN_DIR="$(find /home/expo/workingdir/build/node_modules/.pnpm \
        -maxdepth 4 -name "react-native" -type d 2>/dev/null \
        | grep "/node_modules/react-native$" | head -1)"
fi

HERMES_VER="$(cat "$RN_DIR/sdks/.hermesversion" 2>/dev/null | tr -d '[:space:]')"
if [ -z "$HERMES_VER" ]; then
    log "ERROR: cannot read .hermesversion from $RN_DIR"; exit 1
fi
log "hermes version: $HERMES_VER"

# ── download hermes source ────────────────────────────────────────────────────
SRC="/tmp/hermes-src"
BUILD="/tmp/hermes-build"
rm -rf "$SRC" "$BUILD"
mkdir -p "$SRC" "$BUILD"

TARBALL_URL="https://github.com/facebook/hermes/archive/refs/tags/${HERMES_VER}.tar.gz"
log "downloading $TARBALL_URL"
curl -fsSL --retry 3 --max-time 600 "$TARBALL_URL" | tar xz -C "$SRC" --strip-components=1
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    log "ERROR: source download failed"; exit 1
fi
log "source extracted"

# ── cmake configure ───────────────────────────────────────────────────────────
log "cmake configure"
cd "$BUILD"
"$CMAKE" "$SRC" \
    -DHERMES_IS_ANDROID=False \
    -DHERMES_ENABLE_DEBUGGER=False \
    -DHERMES_BUILD_SHARED_JSI=False \
    -DHERMES_ENABLE_TOOLS=True \
    -DLLVM_INCLUDE_TESTS=OFF \
    -DCMAKE_BUILD_TYPE=Release 2>&1
if [ $? -ne 0 ]; then
    log "ERROR: cmake configure failed"; exit 1
fi

CORES="$(nproc 2>/dev/null || echo 2)"
log "cmake build hermesc ($CORES cores)"
"$CMAKE" --build "$BUILD" --target hermesc -j"$CORES" 2>&1
if [ $? -ne 0 ]; then
    log "ERROR: cmake build failed"; exit 1
fi

# ── cache binary ──────────────────────────────────────────────────────────────
BUILT="$(find "$BUILD" -name "hermesc" -type f 2>/dev/null | head -1)"
if [ -z "$BUILT" ]; then
    log "ERROR: hermesc not found in build output"
    find "$BUILD" -type f 2>/dev/null | head -20 >&2
    exit 1
fi

log "built: $BUILT"
mkdir -p "$(dirname "$CACHE")"
cp "$BUILT" "$CACHE"
chmod +x "$CACHE"

# Populate hook cache too (future hook cache hits become fast paths)
mkdir -p /tmp/hermesc-cache
cp "$CACHE" /tmp/hermesc-cache/hermesc 2>/dev/null || true

log "done — exec"
exec "$CACHE" "$@"
