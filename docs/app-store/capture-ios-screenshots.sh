#!/usr/bin/env bash
# Capture iOS App Store screenshots from a running iPhone Simulator.
#
# Usage:
#   1. Boot the target simulator manually (Simulator.app → Devices → iPhone 17 Pro Max).
#   2. Open the app and navigate to the screen you want to capture.
#   3. Run: ./capture-ios-screenshots.sh <name>
#      e.g. ./capture-ios-screenshots.sh 01-dashboard
#
# Output:
#   docs/app-store/screenshots/<device>/<name>.png
#
# Apple requires:
#   - 6.9" iPhone: 1320×2868 (iPhone 17 Pro Max, 16 Pro Max)
#   - 13" iPad:    2064×2752 (iPad Pro 13" M5)
#
# The simulator captures at native resolution, so just boot the right device.

set -euo pipefail

NAME="${1:-screenshot}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT/screenshots"

# Identify the booted simulator
DEVICE_INFO=$(xcrun simctl list devices booted | grep -E "Booted" | head -1 || true)
if [[ -z "$DEVICE_INFO" ]]; then
  echo "❌ No booted simulator. Boot one in Simulator.app first."
  exit 1
fi

DEVICE_NAME=$(echo "$DEVICE_INFO" | sed -E 's/^[[:space:]]+//; s/ \([A-F0-9-]+\).*//')
DEVICE_SLUG=$(echo "$DEVICE_NAME" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

mkdir -p "$OUT_DIR/$DEVICE_SLUG"
OUT_FILE="$OUT_DIR/$DEVICE_SLUG/$NAME.png"

xcrun simctl io booted screenshot "$OUT_FILE"

# Verify dimensions
DIMS=$(sips -g pixelWidth -g pixelHeight "$OUT_FILE" | awk '/pixel/ {print $2}' | paste -sd 'x' -)

echo "✅ Captured: $OUT_FILE"
echo "   Device:   $DEVICE_NAME"
echo "   Size:     $DIMS"

case "$DIMS" in
  1320x2868) echo "   ✓ App Store 6.9\" iPhone — required size" ;;
  1290x2796) echo "   ⚠  6.7\" iPhone (deprecated post-2024). Apple now requires 6.9\"." ;;
  2064x2752) echo "   ✓ App Store 13\" iPad — required if supportsTablet=true" ;;
  *)         echo "   ⚠  Unexpected size. Apple wants 1320×2868 (6.9\") or 2064×2752 (iPad 13\")." ;;
esac
