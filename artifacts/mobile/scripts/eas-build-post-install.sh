#!/bin/bash
set -euo pipefail
echo "[TRAMPAJ-HERMES-HOOK] start"
pwd
echo "EAS_BUILD_PLATFORM=${EAS_BUILD_PLATFORM:-unknown}"

# Resolve react-native package dir (handles pnpm symlinks correctly)
RN_DIR="$(node -p "path.dirname(require.resolve('react-native/package.json'))")"
RN_VERSION="$(node -p "require('react-native/package.json').version")"
echo "RN_DIR=$RN_DIR"
echo "RN_VERSION=$RN_VERSION"

# We will replace the broken 0.12.0 placeholder hermesc with a real one.
PLACEHOLDER="$RN_DIR/sdks/hermesc/linux64-bin/hermesc"
CACHE_DIR="/tmp/hermesc-cache"
CACHE="$CACHE_DIR/hermesc"

echo "[TRAMPAJ-HERMES-HOOK] placeholder path: $PLACEHOLDER"

# Fast path: use cached binary
if [ -f "$CACHE" ]; then
    echo "[TRAMPAJ-HERMES-HOOK] cache hit — installing cached binary"
    cp "$CACHE" "$PLACEHOLDER"
    chmod +x "$PLACEHOLDER"
    "$PLACEHOLDER" --version || true
    echo "[TRAMPAJ-HERMES-HOOK] done (from cache)"
    exit 0
fi

echo "[TRAMPAJ-HERMES-HOOK] cache miss — downloading pre-built hermesc"

# React Native publishes pre-built hermesc to Maven Central for every release:
# https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/<RN_VERSION>/react-native-artifacts-<RN_VERSION>-hermesc-linux-amd64.tar.gz
MAVEN_URL="https://repo1.maven.org/maven2/com/facebook/react/react-native-artifacts/${RN_VERSION}/react-native-artifacts-${RN_VERSION}-hermesc-linux-amd64.tar.gz"
echo "[TRAMPAJ-HERMES-HOOK] trying Maven Central: $MAVEN_URL"

WORK="/tmp/hermesc-dl"
rm -rf "$WORK"
mkdir -p "$WORK"

DOWNLOAD_OK=0
if curl -f -L --retry 3 --max-time 120 "$MAVEN_URL" -o "$WORK/hermesc.tar.gz" 2>&1; then
    echo "[TRAMPAJ-HERMES-HOOK] download succeeded, extracting"
    tar -xzf "$WORK/hermesc.tar.gz" -C "$WORK"
    # The tarball should contain hermesc (possibly nested)
    HERMESC_BIN="$(find "$WORK" -name "hermesc" -type f | head -1)"
    if [ -n "$HERMESC_BIN" ]; then
        echo "[TRAMPAJ-HERMES-HOOK] found hermesc at $HERMESC_BIN"
        DOWNLOAD_OK=1
    else
        echo "[TRAMPAJ-HERMES-HOOK] hermesc not found in tarball, listing contents:"
        find "$WORK" -type f | head -20
    fi
fi

if [ "$DOWNLOAD_OK" -eq 0 ]; then
    echo "[TRAMPAJ-HERMES-HOOK] Maven download failed — building from source"

    # Ensure cmake is available
    if ! command -v cmake &>/dev/null; then
        echo "[TRAMPAJ-HERMES-HOOK] downloading cmake static binary"
        mkdir -p /tmp/cmake-dl
        curl -L --retry 3 \
            "https://github.com/Kitware/CMake/releases/download/v3.28.3/cmake-3.28.3-linux-x86_64.tar.gz" \
            | tar xz -C /tmp/cmake-dl --strip-components=1
        export PATH="/tmp/cmake-dl/bin:$PATH"
    fi
    cmake --version | head -1

    HERMES_VER="$(cat "$RN_DIR/sdks/.hermesversion" | tr -d '[:space:]')"
    echo "[TRAMPAJ-HERMES-HOOK] hermes tag: $HERMES_VER"

    SRC="/tmp/hermes-src"
    BUILD="/tmp/hermes-build"
    rm -rf "$SRC" "$BUILD"
    mkdir -p "$SRC" "$BUILD"

    # Try GitHub release tarball for this exact hermes version
    # The tag in .hermesversion is used as a git ref; tarball URL:
    TARBALL_URL="https://github.com/facebook/hermes/tarball/$HERMES_VER"
    echo "[TRAMPAJ-HERMES-HOOK] downloading $TARBALL_URL"
    curl -L --retry 3 --max-time 300 "$TARBALL_URL" | tar xz -C "$SRC" --strip-components=1

    cd "$BUILD"
    cmake "$SRC" \
        -DHERMES_IS_ANDROID=False \
        -DHERMES_ENABLE_DEBUGGER=False \
        -DHERMES_BUILD_SHARED_JSI=False \
        -DHERMES_ENABLE_TOOLS=True \
        -DLLVM_INCLUDE_TESTS=OFF \
        -DCMAKE_BUILD_TYPE=Release 2>&1

    echo "[TRAMPAJ-HERMES-HOOK] cmake build hermesc ($(nproc) cores)"
    cmake --build "$BUILD" --target hermesc -j"$(nproc)" 2>&1

    HERMESC_BIN="$(find "$BUILD" -name "hermesc" -type f | head -1)"
    if [ -z "$HERMESC_BIN" ]; then
        echo "[TRAMPAJ-HERMES-HOOK] ERROR: hermesc not found after source build"
        find "$BUILD" -type f 2>/dev/null | head -30
        exit 1
    fi
    echo "[TRAMPAJ-HERMES-HOOK] source build found hermesc at $HERMESC_BIN"
fi

# Cache and install
mkdir -p "$CACHE_DIR"
cp "$HERMESC_BIN" "$CACHE"
chmod +x "$CACHE"

cp "$CACHE" "$PLACEHOLDER"
chmod +x "$PLACEHOLDER"

echo "[TRAMPAJ-HERMES-HOOK] installed at $PLACEHOLDER"
"$PLACEHOLDER" --version || true

echo "[TRAMPAJ-HERMES-HOOK] done"
