#!/bin/bash
# EAS Build post-install hook
# Builds hermesc from source because:
# - react-native ships hermesc 0.12.0 (placeholder) that does NOT support async arrow functions
# - hermesc 0.12.0 fails with "async functions are unsupported" on the Metro bundle
# - Building from source gives the correct hermesc matching the RN 0.81 Hermes runtime version
# - Result cached at /tmp/hermesc-cache between EAS builds (via eas.json cache.paths)
#
# PathUtils.kt resolution order:
#  1. config.hermesCommand (if set)
#  2. node_modules/react-native/ReactAndroid/hermes-engine/build/hermes/bin/hermesc  ← we target this
#  3. node_modules/react-native/sdks/hermesc/linux64-bin/hermesc (0.12.0 placeholder)

set -e

echo ""
echo "=========================================="
echo "  hermesc build hook — RN 0.81 pnpm fix  "
echo "=========================================="
echo ""

# Find react-native package location (pnpm monorepo — must cd to the mobile app)
cd artifacts/mobile
RN_PATH=$(node -e "const path=require('path'); const rn=require.resolve('react-native/package.json'); console.log(path.dirname(rn));")
cd - > /dev/null

if [ -z "$RN_PATH" ]; then
    echo "ERROR: Could not locate react-native package"
    exit 1
fi

echo "React Native: $RN_PATH"

HERMES_VERSION_FILE="$RN_PATH/sdks/.hermesversion"
if [ ! -f "$HERMES_VERSION_FILE" ]; then
    echo "ERROR: .hermesversion not found at $HERMES_VERSION_FILE"
    exit 1
fi

HERMES_VERSION=$(cat "$HERMES_VERSION_FILE" | tr -d '[:space:]')
echo "Hermes version: $HERMES_VERSION"

# Target location (PathUtils.kt option-2 — takes priority over the 0.12.0 placeholder)
HERMESC_TARGET="$RN_PATH/ReactAndroid/hermes-engine/build/hermes/bin/hermesc"
# Cache location (persisted by EAS between builds via eas.json cache.paths)
HERMESC_CACHE_DIR="/tmp/hermesc-cache"
HERMESC_CACHE="$HERMESC_CACHE_DIR/hermesc"

# Fast path: use cached binary if already built
if [ -f "$HERMESC_CACHE" ]; then
    echo "Cache hit — using cached hermesc"
    mkdir -p "$(dirname "$HERMESC_TARGET")"
    cp "$HERMESC_CACHE" "$HERMESC_TARGET"
    chmod +x "$HERMESC_TARGET"
    echo "Installed to: $HERMESC_TARGET"
    "$HERMESC_TARGET" --version
    # Also replace the placeholder so option-3 also works
    cp "$HERMESC_CACHE" "$RN_PATH/sdks/hermesc/linux64-bin/hermesc"
    echo "Done (from cache)"
    exit 0
fi

# Slow path: download source + build
echo "Cache miss — building hermesc from source..."
echo ""

# Ensure cmake is available (Ubuntu EAS workers should have it)
if ! command -v cmake &> /dev/null; then
    echo "cmake not found, installing..."
    apt-get update -qq && apt-get install -y --no-install-recommends cmake
fi
echo "cmake: $(cmake --version | head -1)"

# Ensure a C++ compiler is available
if command -v clang &> /dev/null; then
    echo "compiler: clang $(clang --version | head -1)"
elif command -v g++ &> /dev/null; then
    echo "compiler: g++ $(g++ --version | head -1)"
else
    echo "No C++ compiler found, installing g++..."
    apt-get update -qq && apt-get install -y --no-install-recommends g++
fi

WORK_DIR="/tmp/hermes-src-build"
HERMES_SRC="$WORK_DIR/src"
HERMES_BUILD="$WORK_DIR/build"
rm -rf "$WORK_DIR"
mkdir -p "$HERMES_SRC" "$HERMES_BUILD"

TARBALL_URL="https://github.com/facebook/hermes/tarball/$HERMES_VERSION"
echo "Downloading: $TARBALL_URL"
curl -L --retry 3 --progress-bar "$TARBALL_URL" -o "$WORK_DIR/hermes.tar.gz"

echo "Extracting source..."
tar -xzf "$WORK_DIR/hermes.tar.gz" -C "$HERMES_SRC" --strip-components=1

echo ""
echo "Configuring hermesc build (minimal: compiler only, no debugger/tools)..."
cd "$HERMES_BUILD"
cmake "$HERMES_SRC" \
    -DHERMES_IS_ANDROID=False \
    -DHERMES_ENABLE_DEBUGGER=False \
    -DHERMES_BUILD_SHARED_JSI=False \
    -DHERMES_ENABLE_TOOLS=False \
    -DCMAKE_BUILD_TYPE=Release \
    -G Ninja 2>/dev/null || \
cmake "$HERMES_SRC" \
    -DHERMES_IS_ANDROID=False \
    -DHERMES_ENABLE_DEBUGGER=False \
    -DHERMES_BUILD_SHARED_JSI=False \
    -DHERMES_ENABLE_TOOLS=False \
    -DCMAKE_BUILD_TYPE=Release

echo ""
echo "Building hermesc with $(nproc) cores..."
cmake --build . --target hermesc -j$(nproc)

BUILT="$HERMES_BUILD/bin/hermesc"
if [ ! -f "$BUILT" ]; then
    # Some cmake build systems output directly to the build root
    BUILT="$HERMES_BUILD/hermesc"
fi
if [ ! -f "$BUILT" ]; then
    echo "ERROR: hermesc binary not found after build!"
    echo "Build directory contents:"
    find "$HERMES_BUILD" -name "hermesc" 2>/dev/null || echo "(not found)"
    exit 1
fi

echo ""
"$BUILT" --version

# Cache the binary
mkdir -p "$HERMESC_CACHE_DIR"
cp "$BUILT" "$HERMESC_CACHE"
chmod +x "$HERMESC_CACHE"
echo "Cached to: $HERMESC_CACHE"

# Install to target (PathUtils.kt option-2)
mkdir -p "$(dirname "$HERMESC_TARGET")"
cp "$BUILT" "$HERMESC_TARGET"
chmod +x "$HERMESC_TARGET"
echo "Installed to: $HERMESC_TARGET"

# Also replace the placeholder (option-3 fallback — belt + suspenders)
cp "$BUILT" "$RN_PATH/sdks/hermesc/linux64-bin/hermesc"
echo "Replaced placeholder at: $RN_PATH/sdks/hermesc/linux64-bin/hermesc"

echo ""
echo "=== hermesc setup complete ==="
cd - > /dev/null
