#!/bin/bash
# hermesc-wrapper.sh — builds hermesc from source on first run, caches it.
# Invoked by Gradle as hermesCommand during createBundleReleaseJsAndAssets.
# At that point cmake 3.22.1 is already installed by the configureCMake tasks
# that run concurrently with Metro bundling.

set -uo pipefail

CACHE="/tmp/hermesc-bin/hermesc"
TAG="[TRAMPAJ-HERMESC]"
log() { echo "$TAG $*" >&2; }

log "invoked (args: $*)"

# ── fast path ─────────────────────────────────────────────────────────────────
if [ -f "$CACHE" ] && [ -x "$CACHE" ]; then
    log "cache hit → exec"
    exec "$CACHE" "$@"
fi

log "cache miss — building hermesc from source"

# ── find cmake ────────────────────────────────────────────────────────────────
CMAKE=""

# Android SDK cmake (installed during configureCMake tasks which run in
# parallel with Metro bundling — wait up to 180 s for it to appear)
log "waiting for Android SDK cmake..."
for i in $(seq 1 180); do
    for VER in 3.22.1 3.28.3 3.31.6; do
        P="/home/expo/Android/Sdk/cmake/$VER/bin/cmake"
        if [ -f "$P" ] && [ -x "$P" ]; then
            CMAKE="$P"
            log "found SDK cmake $VER after ${i}s"
            break 2
        fi
    done
    sleep 1
done

# System cmake fallback
if [ -z "$CMAKE" ] && command -v cmake &>/dev/null; then
    CMAKE="$(which cmake)"
    log "using system cmake: $CMAKE"
fi

# Download static cmake as last resort
if [ -z "$CMAKE" ]; then
    log "downloading static cmake 3.28.3..."
    mkdir -p /tmp/cmake-static
    curl -fsSL --retry 3 --max-time 120 \
        "https://github.com/Kitware/CMake/releases/download/v3.28.3/cmake-3.28.3-linux-x86_64.tar.gz" \
        | tar xz -C /tmp/cmake-static --strip-components=1
    CMAKE="/tmp/cmake-static/bin/cmake"
fi

[ -x "$CMAKE" ] || { log "ERROR: cmake not found"; exit 1; }
log "cmake: $($CMAKE --version | head -1)"

# ── find hermes version ───────────────────────────────────────────────────────
RN_ROOT="/home/expo/workingdir/build/node_modules/react-native"
if [ ! -d "$RN_ROOT" ]; then
    # pnpm flattened layout fallback
    RN_ROOT="$(find /home/expo/workingdir/build/node_modules/.pnpm \
        -maxdepth 5 -name "react-native" -type d 2>/dev/null \
        | grep "/node_modules/react-native$" | head -1)"
fi
HERMES_VER="$(cat "$RN_ROOT/sdks/.hermesversion" 2>/dev/null | tr -d '[:space:]')"
[ -n "$HERMES_VER" ] || { log "ERROR: cannot read .hermesversion from $RN_ROOT"; exit 1; }
log "hermes version: $HERMES_VER"

# ── download hermes source ────────────────────────────────────────────────────
SRC="/tmp/hermes-src-$$"
BUILD="/tmp/hermes-bld-$$"
mkdir -p "$SRC" "$BUILD"

log "downloading hermes source..."
curl -fsSL --retry 3 --max-time 600 \
    "https://github.com/facebook/hermes/archive/refs/tags/${HERMES_VER}.tar.gz" \
    | tar xz -C "$SRC" --strip-components=1
[ ${PIPESTATUS[0]} -eq 0 ] || { log "ERROR: source download failed"; exit 1; }
log "source extracted ($(du -sh $SRC | cut -f1))"

# ── patch CMakeLists.txt to skip ICU (not needed when HERMES_UNICODE_LITE=ON) ─
# Without this patch, cmake errors: "Unable to find ICU."
# The build uses HERMES_UNICODE_LITE=ON which avoids all ICU headers/libs,
# but the top-level CMakeLists.txt still calls find_package(ICU REQUIRED)
# unless we extend the existing APPLE/EMSCRIPTEN/ANDROID shortcircuit condition.
sed -i \
    's/if (APPLE OR EMSCRIPTEN OR HERMES_IS_ANDROID)/if (APPLE OR EMSCRIPTEN OR HERMES_IS_ANDROID OR HERMES_UNICODE_LITE)/' \
    "$SRC/CMakeLists.txt"
log "CMakeLists.txt patched for ICU bypass"

# ── cmake configure ───────────────────────────────────────────────────────────
log "cmake configure..."
"$CMAKE" "$SRC" \
    -B "$BUILD" \
    -DCMAKE_BUILD_TYPE=Release \
    -DHERMES_IS_ANDROID=False \
    -DHERMES_ENABLE_DEBUGGER=False \
    -DHERMES_BUILD_SHARED_JSI=False \
    -DHERMES_ENABLE_TOOLS=True \
    -DHERMES_UNICODE_LITE=ON \
    -DHERMES_ENABLE_INTL=OFF \
    -DLLVM_INCLUDE_TESTS=OFF \
    -DCMAKE_CXX_FLAGS="-O2" 2>&1
[ $? -eq 0 ] || { log "ERROR: cmake configure failed"; exit 1; }

# ── cmake build hermesc ───────────────────────────────────────────────────────
CORES="$(nproc 2>/dev/null || echo 2)"
log "building hermesc ($CORES cores)..."
"$CMAKE" --build "$BUILD" --target hermesc -j"$CORES" 2>&1
[ $? -eq 0 ] || { log "ERROR: cmake build failed"; exit 1; }

# ── install ───────────────────────────────────────────────────────────────────
BUILT="$(find "$BUILD/bin" "$BUILD" -name "hermesc" -type f 2>/dev/null | head -1)"
[ -n "$BUILT" ] || { log "ERROR: hermesc binary not found in build output"; exit 1; }
log "binary: $BUILT ($(du -sh $BUILT | cut -f1))"

mkdir -p "$(dirname "$CACHE")"
cp "$BUILT" "$CACHE"
chmod +x "$CACHE"

# Cleanup
rm -rf "$SRC" "$BUILD"

log "done — exec"
exec "$CACHE" "$@"
