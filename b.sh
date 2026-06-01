#!/bin/bash
set -e

echo "=== Korak 1: OTA update (JS bundle) ==="
cd artifacts/mobile
EXPO_TOKEN=$EXPO_TOKEN \
  EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN \
  eas update --channel preview --non-interactive --message "$(date '+%d.%m.%Y %H:%M') — automatska nadogradnja"

echo ""
echo "=== Korak 2: APK build ==="
EXPO_TOKEN=$EXPO_TOKEN \
  eas build --platform android --profile preview --non-interactive

echo ""
echo "=== Gotovo! APK link je iznad. ==="
