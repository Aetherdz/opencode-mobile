#!/usr/bin/env bash
# Build a release APK from a generated Android project.
# Linux/Cloud Shell helper. For macOS or Windows, prefer EAS Build or
# Android Studio.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${APP_DIR:-$ROOT_DIR/app}"
BUILD_OUT_ROOT="${BUILD_OUT_ROOT:-$ROOT_DIR/.build}"

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/android-sdk}}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$HOME/.gradle}"
export CMAKE_BUILD_PARALLEL_LEVEL="${CMAKE_BUILD_PARALLEL_LEVEL:-2}"

if [ -z "${JAVA_HOME:-}" ] && [ -d /usr/lib/jvm/java-21-openjdk-amd64 ]; then
  export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
fi

if [ ! -x "$APP_DIR/android/gradlew" ]; then
  echo "Missing $APP_DIR/android/gradlew. Run 'npx expo prebuild --platform android' first." >&2
  exit 1
fi

if [ "${SKIP_BUILD_BIND_MOUNTS:-0}" != "1" ]; then
  BUILD_OUT_ROOT="$BUILD_OUT_ROOT" "$ROOT_DIR/scripts/prepare-build-dirs.sh"
fi

cd "$APP_DIR/android"

exec ./gradlew assembleRelease \
  --project-cache-dir "$BUILD_OUT_ROOT/project-cache" \
  -PreactNativeArchitectures="${REACT_NATIVE_ARCHITECTURES:-arm64-v8a}" \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true \
  --max-workers="${GRADLE_MAX_WORKERS:-2}" \
  --no-daemon \
  --console=plain
