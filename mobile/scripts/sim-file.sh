#!/bin/sh
# Copies files into the booted iOS simulator's Files app (Archivos › En mi iPhone),
# so the app's document picker can pick them. Xcode 27 has no Simulator.app drag & drop.
#   mobile/scripts/sim-file.sh ~/Downloads/extracto.pdf [más archivos…]
set -e
dev=$(xcrun simctl list devices booted | grep -o '[0-9A-F-]\{36\}' | head -1)
[ -n "$dev" ] || { echo "No hay un simulador encendido."; exit 1; }
for d in "$HOME/Library/Developer/CoreSimulator/Devices/$dev/data/Containers/Shared/AppGroup"/*/; do
  if strings "$d/.com.apple.mobile_container_manager.metadata.plist" 2>/dev/null | grep -q "group.com.apple.FileProvider.LocalStorage"; then
    cp "$@" "$d/File Provider Storage/" && echo "Listo: Archivos › En mi iPhone"; exit 0
  fi
done
echo "Abre la app Archivos una vez en el simulador y vuelve a intentar."; exit 1
