#!/usr/bin/env bash
# Move Gradle/CMake outputs out of the source tree on memory-constrained Linux
# hosts. Uses bind mounts, so it requires root or passwordless sudo.
# Skip this script on macOS/Windows or when you do not need the workaround.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-$ROOT_DIR/app}"
OUT="${BUILD_OUT_ROOT:-$ROOT_DIR/.build}"

if [ ! -d "$APP_DIR/android" ]; then
  echo "Missing $APP_DIR/android. Run 'npx expo prebuild --platform android' first." >&2
  exit 1
fi

if [ ! -d "$OUT" ]; then
  mkdir -p "$OUT"
fi

bind_dir() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")" "$dst"

  if mountpoint -q "$src" 2>/dev/null; then
    return
  fi
  if [ -L "$src" ]; then
    rm -f "$src"
  elif [ -e "$src" ]; then
    rm -rf "$src"
  fi
  mkdir -p "$src"
  sudo mount --bind "$dst" "$src"
}

bind_dir "$APP_DIR/android/app/build" "$OUT/app-build"
bind_dir "$APP_DIR/android/app/.cxx" "$OUT/app-dot-cxx"
bind_dir "$APP_DIR/android/build" "$OUT/android-root-build"

if [ -d "$APP_DIR/node_modules" ]; then
  find "$APP_DIR/node_modules" -mindepth 2 -maxdepth 3 -type d -path '*/android' 2>/dev/null | while read -r dir; do
    if [ ! -f "$dir/build.gradle" ] && [ ! -f "$dir/build.gradle.kts" ]; then
      continue
    fi
    rel="${dir#"$APP_DIR/node_modules/"}"
    key="${rel//\//_}"
    bind_dir "$dir/build" "$OUT/node/$key/build"
    bind_dir "$dir/.cxx" "$OUT/node/$key/.cxx"
  done
fi

echo "Build dirs bind-mounted from $OUT"
