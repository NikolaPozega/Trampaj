#!/bin/bash
set -euxo pipefail
echo "[TRAMPAJ-HERMES-HOOK] start"
pwd
echo "EAS_BUILD_PLATFORM=${EAS_BUILD_PLATFORM:-unknown}"
node -p "require('./package.json').name"
node -p "require('react-native/package.json').version"

# Determine paths via require.resolve
RN_DIR="$(dirname "$(node -p "require.resolve('react-native/package.json')")")"
TARGET="$RN_DIR/ReactAndroid/hermes-engine/build/hermes/bin/hermesc"
CACHE="/tmp/hermesc-cache/hermesc"
echo "RN_DIR=$RN_DIR"
echo "TARGET=$TARGET"

# Fast path: use cached binary
if [ -f "$CACHE" ]; then
    echo "[TRAMPAJ-HERMES-HOOK] cache hit"
    mkdir -p "$(dirname "$TARGET")"
    cp "$CACHE" "$TARGET"
    chmod +x "$TARGET"
    ls -la "$TARGET"
    "$TARGET" -version || true
    # Also overwrite the 0.12.0 placeholder (option-3 fallback)
    cp "$CACHE" "$RN_DIR/sdks/hermesc/linux64-bin/hermesc"
    echo "[TRAMPAJ-HERMES-HOOK] done"
    exit 0
fi

echo "[TRAMPAJ-HERMES-HOOK] cache miss — building from source"

# Ensure cmake is available — apt-get requires root so download static binary instead
if ! command -v cmake &>/dev/null; then
    echo "[TRAMPAJ-HERMES-HOOK] downloading cmake static binary (no sudo needed)"
    mkdir -p /tmp/cmake-dl
    curl -L --retry 3 \
        "https://github.com/Kitware/CMake/releases/download/v3.28.3/cmake-3.28.3-linux-x86_64.tar.gz" \
        | tar xz -C /tmp/cmake-dl --strip-components=1
    export PATH="/tmp/cmake-dl/bin:$PATH"
fi
cmake --version | head -1

HERMES_VERSION="$(cat "$RN_DIR/sdks/.hermesversion" | tr -d '[:space:]')"
echo "[TRAMPAJ-HERMES-HOOK] hermes version: $HERMES_VERSION"

WORK="/tmp/hermes-src-build"
SRC="$WORK/src"
BUILD="$WORK/build"
rm -rf "$WORK"
mkdir -p "$SRC" "$BUILD"

TARBALL_URL="https://github.com/facebook/hermes/tarball/$HERMES_VERSION"
echo "[TRAMPAJ-HERMES-HOOK] downloading $TARBALL_URL"
curl -L --retry 3 "$TARBALL_URL" -o "$WORK/hermes.tar.gz"

echo "[TRAMPAJ-HERMES-HOOK] extracting"
tar -xzf "$WORK/hermes.tar.gz" -C "$SRC" --strip-components=1

echo "[TRAMPAJ-HERMES-HOOK] cmake configure"
cd "$BUILD"
cmake "$SRC" \
    -DHERMES_IS_ANDROID=False \
    -DHERMES_ENABLE_DEBUGGER=False \
    -DHERMES_BUILD_SHARED_JSI=False \
    -DLLVM_INCLUDE_TESTS=OFF \
    -DCMAKE_BUILD_TYPE=Release

echo "[TRAMPAJ-HERMES-HOOK] cmake build ($(nproc) cores)"
cmake --build . --target hermesc -j"$(nproc)"

BUILT="$BUILD/bin/hermesc"
if [ ! -f "$BUILT" ]; then
    BUILT="$BUILD/hermesc"
fi
if [ ! -f "$BUILT" ]; then
    echo "[TRAMPAJ-HERMES-HOOK] ERROR: hermesc not found after build"
    find "$BUILD" -name "hermesc" 2>/dev/null || echo "(not found)"
    exit 1
fi

echo "[TRAMPAJ-HERMES-HOOK] build successful"

# Cache
mkdir -p "$(dirname "$CACHE")"
cp "$BUILT" "$CACHE"
chmod +x "$CACHE"

# Install to target (PathUtils.kt option-2)
mkdir -p "$(dirname "$TARGET")"
cp "$BUILT" "$TARGET"
chmod +x "$TARGET"

# Also overwrite the 0.12.0 placeholder (option-3 fallback)
cp "$BUILT" "$RN_DIR/sdks/hermesc/linux64-bin/hermesc"

ls -la "$TARGET"
"$TARGET" -version || true
echo "[TRAMPAJ-HERMES-HOOK] done"
