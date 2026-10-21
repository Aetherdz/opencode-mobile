#!/usr/bin/env bash
# Install the Android SDK/NDK needed to build the app.
# This is optional when using EAS Build or Android Studio.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-$ROOT_DIR/app}"
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/android-sdk}}"
CMDLINE_ZIP="commandlinetools-linux-13114758_latest.zip"
CMDLINE_URL="https://dl.google.com/android/repository/${CMDLINE_ZIP}"
PACKAGES=(
  "platform-tools"
  "platforms;android-36"
  "platforms;android-37.0"
  "build-tools;36.0.0"
  "build-tools;37.0.0"
  "ndk;27.1.12297006"
  "cmake;3.22.1"
)

if [ -z "${JAVA_HOME:-}" ] && [ -d /usr/lib/jvm/java-21-openjdk-amd64 ]; then
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
fi
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"

if [ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ] \
  || [ ! -f "$SDK_ROOT/platforms/android-37.0/android.jar" ] \
  || [ ! -x "$SDK_ROOT/build-tools/37.0.0/aapt2" ] \
  || [ ! -d "$SDK_ROOT/ndk/27.1.12297006" ]; then

  mkdir -p "$SDK_ROOT"

  if [ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    curl -L --fail --retry 3 -o "$tmp/cmdline-tools.zip" "$CMDLINE_URL"
    rm -rf "$SDK_ROOT/cmdline-tools/latest"
    unzip -q "$tmp/cmdline-tools.zip" -d "$SDK_ROOT/cmdline-tools"
    mv "$SDK_ROOT/cmdline-tools/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  fi

  yes | "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
    --sdk_root="$SDK_ROOT" --licenses >/dev/null 2>&1 || true

  yes | "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
    --sdk_root="$SDK_ROOT" "${PACKAGES[@]}"
else
  echo "Android SDK already present at $SDK_ROOT"
fi

if [ ! -d "$APP_DIR/android" ]; then
  echo "Missing $APP_DIR/android. Run 'npx expo prebuild --platform android' first." >&2
  exit 1
fi

printf 'sdk.dir=%s\n' "$SDK_ROOT" > "$APP_DIR/android/local.properties"
echo "Wrote $APP_DIR/android/local.properties"
echo "Build with: $ROOT_DIR/scripts/build-apk.sh"
