# Development

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22.13+ | Node 24 LTS is recommended. |
| npm | 10+ | The repository commits both lockfiles. |
| Git | any recent | Use a normal clone; no submodules. |
| OpenCode | 2.0.24 verified | Start it with `opencode service start`. |
| Expo Go or a development build | SDK 58 | Expo Go is enough for JS-only changes. |
| Android Studio / SDK | API 36 or 37 | Only for local native builds. |
| Xcode | current | Only for local iOS builds on macOS. |
| EAS CLI | latest | Optional, for cloud Android/iOS builds. |

The app and bridge are separate npm projects. The root `package.json` only
provides convenience scripts; it is not an npm workspace. Do not delete either
lockfile.

## Clone and install

```bash
git clone https://github.com/OWNER/opencode-mobile.git
cd opencode-mobile
npm run install:bridge
npm run install:app
```

`npm run install:app` and `npm run install:bridge` run `npm ci` in each
directory. If `npm ci` fails, check the Node version first.

## Run OpenCode

```bash
opencode service start
```

The bridge reads `~/.local/state/opencode/service.json`. If your service uses a
different state directory, set `XDG_STATE_HOME`. To use an explicit service:

```bash
export OPENCODE_URL=http://127.0.0.1:49374
export OPENCODE_PASSWORD=...
```

The URL must be loopback. The bridge rejects public OpenCode URLs on purpose.

## Run the bridge

```bash
cd bridge
cp .env.example .env
openssl rand -hex 32
# paste the value into AUTH_TOKEN
# set ALLOWED_WORKDIRS to the project roots you want to allow
npm run dev
```

For a production-style run:

```bash
npm run build
npm start
```

The bridge logs the OpenCode version when it connects. Check it with:

```bash
curl http://127.0.0.1:8787/health
curl -H "Authorization: Bearer $AUTH_TOKEN" http://127.0.0.1:8787/config
```

`/health` is unauthenticated. Everything else needs the token.

## Run the app

In another terminal:

```bash
cd app
npm run start
```

Then press `a` for an Android emulator, `i` for the iOS simulator, or scan the
QR code with Expo Go. The first screen asks for the bridge URL and token.

On an Android emulator, `127.0.0.1` points at the emulator. Use
`adb reverse tcp:8787 tcp:8787` and then `http://127.0.0.1:8787`, or use
`http://10.0.2.2:8787` if the bridge is bound to a reachable interface. The
default bridge bind is loopback, so `adb reverse` is the cleaner option.

On a physical phone, use a Tailscale address or another private address. Do not
use the host's `127.0.0.1`.

## Checks

```bash
npm run check
```

This runs:

1. `app`: `tsc --noEmit`
2. `app`: `expo lint`
3. `bridge`: `tsc -p tsconfig.json --noEmit`
4. `bridge`: `vitest run`

Run the bridge build as well before a release:

```bash
npm run build:bridge
```

Dependency audit:

```bash
cd bridge && npm audit --omit=dev
cd ../app && npm audit --omit=dev
```

The app audit currently reports build-time Expo CLI/Metro advisories. Do not run
`npm audit fix --force`; it downgrades Expo to an incompatible major. See
[docs/security.md](security.md).

The app has no automated UI test suite yet. Device QA is a release gate, not an
optional extra.

## Web build

```bash
cd app
npm run web
```

This starts the Expo web dev server. A production export is:

```bash
npm run web:export
```

The export uses Expo's `server` output. For browser access from a different
origin, add that exact origin to the bridge configuration:

```dotenv
# bridge/.env
CORS_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
```

`CORS_ORIGINS` accepts exact `http://host:port` or `https://host:port` values.
Wildcards, credentials, and paths are rejected, and an empty value disables
CORS. Preflight requests are answered before authentication, but every real
request still needs the bearer token.

For production, prefer serving the exported app and the bridge behind one
origin with a reverse proxy. That avoids exposing the token to third-party
scripts and keeps the browser storage model simple. Do not disable browser
security as a workaround.

## Android

### EAS Build (recommended)

EAS builds do not need a local Android SDK. You need an Expo account and a
project. Add an `eas.json` profile if the repository does not have one yet:

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {}
  }
}
```

Then:

```bash
cd app
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

EAS will create or link the Expo project. Do not commit EAS credentials or
keystores.

### Local build

```bash
cd app
npx expo prebuild --platform android
```

This generates `app/android/`, which is ignored by Git. Then either:

```bash
npx expo run:android
```

or, on Linux with a local SDK:

```bash
../scripts/bootstrap-android-sdk.sh
../scripts/build-apk.sh
```

The helper scripts are optional. They assume:

- Java 21 is available.
- `ANDROID_HOME` or `ANDROID_SDK_ROOT` points at an SDK with API 36/37,
  build-tools 36/37, NDK 27.1, and CMake 3.22.
- `app/android/gradlew` exists.
- You are on Linux if you use `prepare-build-dirs.sh`; it uses bind mounts and
  `sudo`.

`build-apk.sh` writes Gradle output outside the source tree by default. Set
`BUILD_OUT_ROOT` to change the location, or `SKIP_BUILD_BIND_MOUNTS=1` to skip
the bind-mount helper. The release APK is under the generated
`app/android/app/build/outputs/apk/release/` tree.

Current local APKs are debug-signed and must not be published as production
artifacts.

## iOS

iOS builds require macOS and Xcode, or EAS Build:

```bash
cd app
npx expo run:ios
# or
npx eas-cli@latest build -p ios --profile preview
```

The app uses Expo modules that are supported by Expo Go for most screens. A
development build is needed if you add a native module.

## Windows

- The bridge runs natively on Windows with Node.js.
- The Expo dev server runs natively on Windows.
- Bash helper scripts need WSL2 or Git Bash; `prepare-build-dirs.sh` is
  Linux-only because it uses bind mounts.
- Android builds work through EAS, Android Studio, or WSL2 with a Linux SDK.
- iOS builds are not available on Windows.

Use PowerShell for token generation if `openssl` is missing:

```powershell
-join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
```

## macOS

- The bridge and Expo dev server run natively.
- Android builds work with Android Studio or EAS.
- iOS builds work with Xcode or EAS.
- `prepare-build-dirs.sh` is not needed and is not supported.

## Linux

- Native development is supported.
- Android Studio or the command-line SDK both work.
- Use `scripts/bootstrap-android-sdk.sh` when you need a reproducible SDK.
- A headless server should run only the bridge; the app is a client.

## Server deployment

Production recipes are in [deploy/README.md](../deploy/README.md):

- Native Node on Linux, macOS, or Windows.
- Docker Compose on Linux with host networking.
- A hardened systemd unit.
- Caddy for same-origin web and bridge access.
- Tailscale for private remote access.

The Docker path is Linux-only because the bridge must reach OpenCode on
`127.0.0.1` and the workdir paths sent to OpenCode must match the host. On
Docker Desktop for macOS or Windows, run the bridge natively. Do not bake
`.env` or `data/` into an image, and mount only the allowed workdirs.

## Code style

- TypeScript strict mode is on in both projects.
- The app uses the `@/` path alias.
- The bridge uses NodeNext modules and explicit `.js` extensions in imports.
- Keep the three contract copies in sync:
  `shared/contract.ts`, `bridge/src/types.ts`, `app/src/api/types.ts`.
- Run `npm run check` before a pull request.
- Do not add a native dependency without running `expo prebuild` and testing a
  native build.

## Release checklist

- [ ] `npm run check` passes.
- [ ] `npm run build:bridge` passes.
- [ ] `npx expo export --platform web` passes.
- [ ] Device QA is complete on Android and iOS.
- [ ] Version and `versionCode`/`buildNumber` are bumped.
- [ ] `CHANGELOG.md` is updated.
- [ ] No `.env`, `data/`, uploads, APKs, keystores, or screenshots with private
      data are staged.
- [ ] The release tag and APK are signed with the release key.
- [ ] The release notes state the OpenCode version and the beta status.
