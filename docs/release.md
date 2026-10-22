# Release guide

This document covers the public beta release path: versioning, the bridge and
web bundles, the installable APK, checksums, and the GitHub release.

The project uses a split distribution model:

- **Source repository** — source code, CI, release bundles, and the APK.
- **Distribution repository** — `install.sh`, `install.ps1`, and the release
  URL. It never contains application source or secrets.

## Versioning

The public beta version is `1.0.0-beta.1`. A release tag is `v` plus that
version, for example `v1.0.0-beta.1`.

When you bump the version, update all of these together:

| File | Field |
| --- | --- |
| `package.json` | `version` |
| `app/package.json` | `version` |
| `bridge/package.json` | `version` and `bridge/package-lock.json` |
| `app/app.json` | `expo.version` |
| `app/app.json` | `expo.android.versionCode` (integer, always increases) |
| `app/app.json` | `expo.ios.buildNumber` (string, always increases) |
| `CHANGELOG.md` | New dated section |

Use `npm version <version> --no-git-tag-version` inside `app/` and `bridge/` to
update the package metadata without creating a tag.

## Before a release

1. Run the full local check from the repository root:

   ```bash
   npm run check
   npm run build:bridge
   npm run web:export
   ```

2. Confirm the bridge and web bundles start from a clean tree.
3. Run `git status --short` and confirm no `.env`, `data/`, keystore, token, or
   personal path is staged.
4. Confirm the app identity and the unofficial disclaimer are still correct.
5. Update `CHANGELOG.md` and the release notes.

## Bridge bundle

The installer downloads a self-contained production tree:

```bash
npm --prefix bridge ci --no-audit --no-fund
npm --prefix bridge run build
npm --prefix bridge prune --omit=dev
mkdir -p release/bridge
cp bridge/package.json bridge/package-lock.json bridge/.env.example release/bridge/
cp -a bridge/dist bridge/node_modules release/bridge/
tar -czf "opencode-mobile-bridge-${VERSION}.tar.gz" -C release/bridge .
(cd release/bridge && zip -qr "../../opencode-mobile-bridge-${VERSION}.zip" .)
```

The archive root must contain `package.json`, `package-lock.json`, `dist/`, and
production `node_modules/`. The installer verifies this layout. Keep tests,
TypeScript sources, and development dependencies out of the production archive.

## Web bundle

```bash
npm --prefix app ci --no-audit --no-fund
npm --prefix app run web:export
tar -czf "opencode-mobile-web-${VERSION}.tar.gz" -C app/dist .
```

`app/dist/` is a single-page Expo web export with PWA metadata, `404.html`,
`_redirects`, and the install icons. It has no runtime build step.

See [web.md](web.md) for hosting and CORS.

## Android APK

The first public beta publishes the bridge and web bundles only. Build and
attach a release-signed APK with the steps below before presenting an Android
download as available.

### Option A: EAS preview APK (recommended for distribution)

EAS manages the signing key and gives you a stable upgrade path.

```bash
cd app
npx eas-cli login
npx eas-cli init          # once, writes extra.eas.projectId
npx eas-cli build --platform android --profile preview
```

The `preview` profile in `app/eas.json` produces an APK with internal
distribution. Download it from the EAS build page and rename it:

```text
opencode-mobile-1.0.0-beta.1.apk
```

Do not commit the keystore or `credentials.json`. Keep the EAS account and the
keystore under the project owner's control. Losing the keystore prevents
in-place updates of an already installed release.

### Option B: Local debug APK (testing only)

The debug APK is installable and useful for device QA, but it is signed with
the public Android debug key. It is not a production release and must not be
presented as one.

```bash
npm --prefix app ci
cd app
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a
```

The artifact is `app/android/app/build/outputs/apk/debug/app-debug.apk`.
The `Android debug APK` workflow builds this artifact on GitHub Actions for
manual download.

### Option C: Local release APK with your own keystore

Use this only if you understand Android signing. Generate a keystore outside
the repository, keep it backed up, and pass the properties through
`~/.gradle/gradle.properties` or CI secrets. Never commit the keystore,
passwords, or `keystore.properties`.

The generated Expo template signs `release` with the debug key by default. That
is acceptable for a local test build only. Replace the signing configuration
before calling the result a signed release.

## GitHub release

The `Release` workflow runs on `v*` tags or manually with an existing tag. It:

1. Builds the bridge production tree.
2. Exports the web app.
3. Creates bridge and web `.tar.gz` and `.zip` archives.
4. Writes `SHA256SUMS` over every asset.
5. Creates or updates the GitHub Release.

The workflow does **not** build or sign the APK. After the EAS build finishes:

1. Download the APK.
2. Rename it to `opencode-mobile-<version>.apk`.
3. Attach it to the release:

   ```bash
   gh release upload v1.0.0-beta.1 opencode-mobile-1.0.0-beta.1.apk
   ```

4. Regenerate and upload the checksum file:

   ```bash
   sha256sum opencode-mobile-* > SHA256SUMS
   gh release upload v1.0.0-beta.1 SHA256SUMS --clobber
   ```

The distribution installer expects these exact names:

| Asset | Purpose |
| --- | --- |
| `opencode-mobile-bridge-<version>.tar.gz` | POSIX installer |
| `opencode-mobile-bridge-<version>.zip` | Windows installer |
| `opencode-mobile-<version>.apk` | Android app |
| `SHA256SUMS` | Checksums for every asset |

The web archives are optional for the installer and useful for self-hosting.

## Release checklist

- [ ] Version bumped in all files and `versionCode` increased.
- [ ] `npm run check`, bridge build, and web export pass.
- [ ] No secrets, `.env`, `data/`, keystores, or personal paths in the tree.
- [ ] `CHANGELOG.md` has a dated entry.
- [ ] Release tag matches the app version.
- [ ] Bridge and web archives contain the expected roots.
- [ ] APK is signed with the release key, not the debug key.
- [ ] `SHA256SUMS` covers every attached asset.
- [ ] Installer smoke test passes against the published release.
- [ ] The unofficial-project disclaimer is still visible.

## Rollback

Delete or mark the GitHub Release as a pre-release, and publish a new patch
version. Do not reuse a tag with different bytes: installed clients and
checksums depend on immutable assets.
